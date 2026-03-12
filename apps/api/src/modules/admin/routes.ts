import { Readable }                                              from "node:stream";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z }                                                      from "zod";

// ── Validation schemas ────────────────────────────────────────────────────────

/**
 * Full filter schema for the audit log viewer.
 * Replaces the original minimal schema (page + limit only).
 */
const auditLogQuerySchema = z.object({
  /** Filter by Auth0 sub or any stored userId string */
  userId:       z.string().optional(),
  /** Filter by tenant UUID — system_admin only (safety officers are always scoped to own tenant) */
  tenantId:     z.string().uuid().optional(),
  /** Partial case-insensitive match against action (e.g. "alert" matches "alert.acknowledged") */
  action:       z.string().max(200).optional(),
  /** Exact match against resourceType (e.g. "device", "alert", "annotation") */
  resourceType: z.string().max(100).optional(),
  /** ISO 8601 start of date range (inclusive) */
  startDate:    z.string().datetime({ message: "startDate must be a valid ISO datetime." }).optional(),
  /** ISO 8601 end of date range (inclusive) */
  endDate:      z.string().datetime({ message: "endDate must be a valid ISO datetime." }).optional(),
  page:         z.coerce.number().min(1).default(1),
  limit:        z.coerce.number().min(1).max(200).default(50),
});

const pendingQuerySchema = z.object({
  page:  z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const rejectBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

const createDeviceBodySchema = z.object({
  sku:                 z.string().min(1).max(100).trim(),
  name:                z.string().min(2).max(300).trim(),
  description:         z.string().max(5000).trim().optional(),
  modelNumber:         z.string().max(100).trim().optional(),
  manufacturerId:      z.string().uuid("Invalid manufacturer ID"),
  categoryId:          z.string().uuid("Invalid category ID"),
  regulatoryStatus:    z.enum(["approved", "recalled", "pending", "withdrawn"]).default("pending"),
  materialComposition: z.record(z.unknown()).optional(),
  dimensionsMm:        z.record(z.unknown()).optional(),
  sterilizationMethod: z.string().max(200).trim().optional(),
  fdA510kNumber:       z.string().max(100).trim().optional(),
  ceMmarkNumber:       z.string().max(100).trim().optional(),
  compatibilityMatrix: z.record(z.unknown()).optional(),
  extractionTooling:   z.record(z.unknown()).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/**
 * Build a Prisma where clause from the audit log query params.
 *
 * @param q                Parsed query params.
 * @param enforcedTenantId When set, forces tenantId = this value regardless of
 *                         what the caller passed. Used for hospital_safety_officer
 *                         RLS — they can only see their own tenant's logs.
 */
function buildAuditWhere(q: AuditLogQuery, enforcedTenantId?: string) {
  const where: Record<string, unknown> = {};

  // RLS: safety officers are always scoped to their own tenant
  if (enforcedTenantId) {
    where.tenantId = enforcedTenantId;
  } else if (q.tenantId) {
    where.tenantId = q.tenantId;
  }

  if (q.userId) where.userId = q.userId;
  if (q.action) where.action = { contains: q.action, mode: "insensitive" };
  if (q.resourceType) where.resourceType = q.resourceType;

  if (q.startDate || q.endDate) {
    const range: Record<string, Date> = {};
    if (q.startDate) range.gte = new Date(q.startDate);
    if (q.endDate)   range.lte = new Date(q.endDate);
    where.createdAt = range;
  }

  return where;
}

/** CSV column order for the audit log export */
const CSV_COLUMNS = [
  "id",
  "timestamp",
  "userId",
  "tenantId",
  "userEmail",
  "userRole",
  "action",
  "resourceType",
  "resourceId",
  "responseStatus",
  "ipAddress",
  "userAgent",
  "requestId",
  "oldValues",
  "newValues",
] as const;

/** Escape a single CSV cell value — wraps in quotes if it contains delimiters. */
function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // RFC 4180: fields containing commas, double-quotes, or newlines must be quoted
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require hospital_safety_officer or system_admin role
  fastify.addHook(
    "preHandler",
    fastify.requireRole("hospital_safety_officer", "system_admin")
  );

  // ── GET /admin/stats — operational dashboard counts ───────────────────────
  fastify.get("/stats", async (request) => {
    const tenantId = request.user.tenantId;
    const today    = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingDevices, auditEventsToday, activeDevices, activeAlerts] =
      await Promise.all([
        fastify.db.device.count({
          where: { approvalStatus: "pending", isActive: true },
        }),
        fastify.db.auditLog.count({
          where: { tenantId, createdAt: { gte: today } },
        }),
        fastify.db.device.count({
          where: { isActive: true, approvalStatus: "approved" },
        }),
        fastify.db.alert.count({
          where: {
            tenantAlertAcknowledgements: { none: { tenantId } },
          },
        }),
      ]);

    return { pendingDevices, auditEventsToday, activeDevices, activeAlerts };
  });

  // ── GET /admin/devices/pending — devices awaiting approval ────────────────
  fastify.get("/devices/pending", async (request) => {
    const query  = pendingQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.limit;

    const [devices, total] = await Promise.all([
      fastify.db.device.findMany({
        where:   { approvalStatus: "pending", isActive: true },
        include: {
          manufacturer: { select: { id: true, name: true, slug: true } },
          category:     { select: { id: true, name: true } },
        },
        skip:    offset,
        take:    query.limit,
        orderBy: { createdAt: "desc" },
      }),
      fastify.db.device.count({
        where: { approvalStatus: "pending", isActive: true },
      }),
    ]);

    await fastify.audit(request, {
      action:       "admin.pending_devices.listed",
      resourceType: "device",
    });

    return { data: devices, total, page: query.page, limit: query.limit };
  });

  // ── POST /admin/devices — create a new device (both admin roles) ──────────
  //
  // Newly created devices start with approvalStatus: "pending" — the creator
  // (or another officer) still needs to approve via the approve endpoint.
  //
  fastify.post(
    "/devices",
    async (request, reply) => {
      const body = createDeviceBodySchema.parse(request.body);

      // Verify manufacturer + category exist before creating
      const [mfr, cat] = await Promise.all([
        fastify.db.manufacturer.findUnique({ where: { id: body.manufacturerId }, select: { id: true, name: true } }),
        fastify.db.deviceCategory.findUnique({ where: { id: body.categoryId   }, select: { id: true, name: true } }),
      ]);
      if (!mfr) return reply.code(400).send({ message: "Manufacturer not found" });
      if (!cat) return reply.code(400).send({ message: "Category not found" });

      const device = await fastify.db.device.create({
        data: {
          sku:                 body.sku,
          name:                body.name,
          description:         body.description,
          modelNumber:         body.modelNumber,
          manufacturerId:      body.manufacturerId,
          categoryId:          body.categoryId,
          regulatoryStatus:    body.regulatoryStatus,
          materialComposition: body.materialComposition as any,
          dimensionsMm:        body.dimensionsMm as any,
          compatibilityMatrix: body.compatibilityMatrix as any,
          extractionTooling:   body.extractionTooling as any,
          sterilizationMethod: body.sterilizationMethod,
          fdA510kNumber:       body.fdA510kNumber,
          ceMmarkNumber:       body.ceMmarkNumber,
          approvalStatus:      "pending",
          isActive:            true,
        },
        include: {
          manufacturer: { select: { id: true, name: true, slug: true } },
          category:     { select: { id: true, name: true, code: true } },
        },
      });

      // Bust search cache so the new device surfaces after approval
      await fastify.redis.del("device_meta");

      await fastify.audit(request, {
        action:       "admin.device.created",
        resourceType: "device",
        resourceId:   device.id,
        newValues:    { sku: body.sku, name: body.name, createdBy: request.user.email },
      });

      return reply.code(201).send(device);
    }
  );

  // ── GET /admin/audit-logs — paginated audit log viewer with full filtering ─
  //
  // RLS rules:
  //   hospital_safety_officer → scoped to own tenantId (enforced server-side,
  //                             any tenantId param in the query is ignored)
  //   system_admin            → may query any tenant or all tenants
  //
  // Filters: userId, tenantId (admin only), action (partial), resourceType
  //          (exact), startDate, endDate, page, limit.
  //
  // Each log row includes inline user and tenant snapshots (denormalized at
  // write time) — no FK joins needed, ensuring the viewer is always fast
  // even as the audit log grows to tens of millions of rows.
  //
  fastify.get("/audit-logs", async (request) => {
    const q        = auditLogQuerySchema.parse(request.query);
    const isAdmin  = request.user.role === "system_admin";
    // Safety officers are always locked to their own tenant
    const enforcedTenantId = isAdmin ? undefined : request.user.tenantId;

    const where  = buildAuditWhere(q, enforcedTenantId);
    const offset = (q.page - 1) * q.limit;

    const [logs, total] = await Promise.all([
      fastify.db.auditLog.findMany({
        where,
        select: {
          id:             true,
          createdAt:      true,
          userId:         true,
          tenantId:       true,
          userEmail:      true,
          userRole:       true,
          action:         true,
          resourceType:   true,
          resourceId:     true,
          responseStatus: true,
          ipAddress:      true,
          userAgent:      true,
          requestId:      true,
          // Change-data fields: returned for business-level events; null for HTTP-level entries
          oldValues:      true,
          newValues:      true,
        },
        orderBy: { createdAt: "desc" },
        skip:    offset,
        take:    q.limit,
      }),
      fastify.db.auditLog.count({ where }),
    ]);

    const data = logs.map(log => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));

    return { data, total, page: q.page, limit: q.limit };
  });

  // ── GET /admin/audit-logs/export — chunked CSV stream ────────────────────
  //
  // Same RLS and filter logic as GET /admin/audit-logs.
  //
  // Streaming design (pre-Rigshospitalet scaling threshold):
  //   The previous implementation built the full CSV string in-memory before
  //   sending (~30 MB at 100k rows). Under sustained concurrent export usage
  //   from multiple safety officers this caused GC pressure spikes.
  //
  //   This version uses a push-mode Node.js Readable piped to reply.send().
  //   Rows are fetched from Postgres in pages of PAGE_SIZE via Prisma cursor
  //   pagination, formatted one row at a time, and pushed to the stream.
  //   Heap cost is bounded to O(PAGE_SIZE) rows ≈ 150 KB regardless of export
  //   size or the 100k cap. Fastify drains the stream while the async loop
  //   fills it, so backpressure is handled at the OS TCP layer.
  //
  // CSV columns: id, timestamp, userId, tenantId, userEmail, userRole,
  //   action, resourceType, resourceId, responseStatus, ipAddress, userAgent,
  //   requestId, oldValues (JSON string), newValues (JSON string).
  //
  // Headers:
  //   Content-Type:        text/csv; charset=utf-8
  //   Content-Disposition: attachment; filename="audit-logs-YYYY-MM-DD.csv"
  //   Transfer-Encoding:   chunked  (set automatically by Fastify for streams)
  //
  fastify.get("/audit-logs/export", async (request, reply) => {
    const q       = auditLogQuerySchema.parse(request.query);
    const isAdmin = request.user.role === "system_admin";
    const enforcedTenantId = isAdmin ? undefined : request.user.tenantId;

    const where    = buildAuditWhere(q, enforcedTenantId);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    // Safety cap: stop emitting rows beyond this count.
    // Does NOT prevent the query from running — pagination loop breaks on cap.
    const EXPORT_CAP = 100_000;
    // Rows fetched per Prisma round-trip.
    // 500 rows × ~300 bytes ≈ 150 KB per page — well under V8's young-gen slab.
    const PAGE_SIZE  = 500;

    // Push-mode Readable: we control when data enters the stream.
    // `read()` is a no-op because we push proactively from the async loop below.
    const csvStream = new Readable({ read() {} });

    // Kick off the DB iteration independently of Fastify's response pipeline.
    // reply.send(csvStream) below starts piping immediately; rows are written
    // to the stream as each Prisma page resolves.
    (async () => {
      try {
        // RFC 4180 header row
        csvStream.push(CSV_COLUMNS.join(",") + "\r\n");

        let cursor:   string | undefined;
        let exported = 0;

        while (exported < EXPORT_CAP) {
          const page = await fastify.db.auditLog.findMany({
            where,
            select: {
              id:             true,
              createdAt:      true,
              userId:         true,
              tenantId:       true,
              userEmail:      true,
              userRole:       true,
              action:         true,
              resourceType:   true,
              resourceId:     true,
              responseStatus: true,
              ipAddress:      true,
              userAgent:      true,
              requestId:      true,
              oldValues:      true,
              newValues:      true,
            },
            orderBy: { createdAt: "desc" },
            take:    PAGE_SIZE,
            // Cursor pagination: skip the row we used as the cursor in the
            // previous iteration (skip: 1), then take the next PAGE_SIZE rows.
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          });

          if (page.length === 0) break;

          for (const log of page) {
            csvStream.push(
              [
                csvCell(log.id),
                csvCell(log.createdAt.toISOString()),
                csvCell(log.userId),
                csvCell(log.tenantId),
                csvCell(log.userEmail),
                csvCell(log.userRole),
                csvCell(log.action),
                csvCell(log.resourceType),
                csvCell(log.resourceId),
                csvCell(log.responseStatus),
                csvCell(log.ipAddress),
                csvCell(log.userAgent),
                csvCell(log.requestId),
                csvCell(log.oldValues),
                csvCell(log.newValues),
              ].join(",") + "\r\n"
            );
            exported++;
          }

          cursor = page[page.length - 1].id;
          // Natural end of result set
          if (page.length < PAGE_SIZE) break;
        }

        // Signal EOF — Fastify closes the response after draining
        csvStream.push(null);

        // Audit after we know the exact row count.
        // The request object is alive until the stream is fully consumed.
        await fastify.audit(request, {
          action:       "admin.audit_logs.exported",
          resourceType: "audit_log",
          newValues: {
            filters: {
              userId:       q.userId,
              tenantId:     q.tenantId,
              action:       q.action,
              resourceType: q.resourceType,
              startDate:    q.startDate,
              endDate:      q.endDate,
            },
            rowCount:  exported,
            exportCap: EXPORT_CAP,
            pageSize:  PAGE_SIZE,
          },
        });

      } catch (err) {
        // Destroying the stream causes Fastify to abort the chunked response,
        // which closes the TCP connection — the correct signal to the client
        // that the export was incomplete. Headers have already been sent so
        // we cannot change the HTTP status code.
        fastify.log.error({ err }, "[audit-export] stream iteration failed");
        csvStream.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return reply
      .header("Content-Type",        "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csvStream);
  });

  // ── Shared approve/reject logic ───────────────────────────────────────────
  //
  // Both POST (legacy) and PATCH are supported:
  //   POST  /admin/devices/:id/approve  — original endpoint (kept for back-compat)
  //   PATCH /admin/devices/:id/approve  — RESTful alias (frontend uses this)
  //   POST  /admin/devices/:id/reject   — original endpoint
  //   PATCH /admin/devices/:id/reject   — RESTful alias
  //

  // Helper: SCAN + DEL all device_search:* keys
  async function bustSearchCache(): Promise<void> {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await fastify.redis.scan(
        cursor, "MATCH", "device_search:*", "COUNT", 100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await fastify.redis.del(...keys);
      }
    } while (cursor !== "0");
  }

  async function handleApprove(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply:   FastifyReply,
  ) {
    const { id } = request.params;

    // Resolve Auth0 sub → internal users.id UUID
    const approver = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true },
    });
    if (!approver) {
      return reply.code(403).send({ message: "Approver user record not found" });
    }

    const device = await fastify.db.device.findUnique({
      where:  { id },
      select: { id: true, approvalStatus: true, name: true },
    });

    if (!device) return reply.code(404).send({ message: "Device not found" });
    if (device.approvalStatus !== "pending") {
      return reply
        .code(409)
        .send({ message: `Device is already ${device.approvalStatus}` });
    }

    const updated = await fastify.db.device.update({
      where: { id },
      data: {
        approvalStatus: "approved",
        approvedById:   approver.id,
        approvedAt:     new Date(),
      },
    });

    await Promise.all([
      fastify.redis.del(`device:${id}`),
      bustSearchCache(),
    ]);

    await fastify.audit(request, {
      action:       "device.approved",
      resourceType: "device",
      resourceId:   id,
      oldValues:    { approvalStatus: "pending" },
      newValues:    { approvalStatus: "approved", approvedBy: request.user.email },
    });

    return updated;
  }

  async function handleReject(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply:   FastifyReply,
  ) {
    const { id } = request.params;
    const body   = rejectBodySchema.parse(request.body);

    const device = await fastify.db.device.findUnique({
      where:  { id },
      select: { id: true, approvalStatus: true },
    });

    if (!device) return reply.code(404).send({ message: "Device not found" });

    await fastify.db.device.update({
      where: { id },
      data:  { approvalStatus: "rejected" },
    });

    await fastify.redis.del(`device:${id}`);

    await fastify.audit(request, {
      action:       "device.rejected",
      resourceType: "device",
      resourceId:   id,
      oldValues:    { approvalStatus: device.approvalStatus },
      newValues:    { approvalStatus: "rejected", reason: body.reason },
    });

    return reply.code(204).send();
  }

  // ── POST /admin/devices/:id/approve (legacy) ──────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/devices/:id/approve",
    async (request, reply) => handleApprove(request, reply)
  );

  // ── PATCH /admin/devices/:id/approve (RESTful alias) ─────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/devices/:id/approve",
    async (request, reply) => handleApprove(request, reply)
  );

  // ── POST /admin/devices/:id/reject (legacy) ───────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/devices/:id/reject",
    async (request, reply) => handleReject(request, reply)
  );

  // ── PATCH /admin/devices/:id/reject (RESTful alias) ──────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/devices/:id/reject",
    async (request, reply) => handleReject(request, reply)
  );

  // ── PATCH /admin/annotations/:id/moderate ─────────────────────────────────
  //
  // Moderation queue action for flagged annotations.
  //
  // Body:
  //   action:      "approve" — restore the annotation to published status
  //                "reject"  — permanently remove the annotation (sets status "removed")
  //   reviewNotes: optional free-text rationale stored in the audit trail
  //
  // RBAC: hospital_safety_officer + system_admin (inherited from route scope hook)
  //
  // Annotations are immutable once published — the "approve" action restores
  // status to "published" without modifying content. "reject" sets status to
  // "removed" and strips platform visibility, making it inaccessible to all
  // users. Both outcomes are recorded in the immutable audit log.
  //
  const moderateBodySchema = z.object({
    action:      z.enum(["approve", "reject"]),
    reviewNotes: z.string().max(2000).trim().optional(),
  });

  fastify.patch<{ Params: { id: string } }>(
    "/annotations/:id/moderate",
    async (request, reply) => {
      const { id }   = request.params;
      const body     = moderateBodySchema.parse(request.body);

      const annotation = await fastify.db.annotation.findUnique({
        where:  { id },
        select: { id: true, status: true, title: true, tenantId: true },
      });

      if (!annotation) {
        return reply.code(404).send({ message: "Annotation not found" });
      }

      // Only flagged or under_review annotations are valid moderation targets
      if (!["flagged", "under_review"].includes(annotation.status)) {
        return reply.code(409).send({
          message: `Annotation is already "${annotation.status}" — only flagged or under_review annotations can be moderated`,
        });
      }

      const newStatus = body.action === "approve" ? "published" : "removed";

      const updated = await fastify.db.annotation.update({
        where: { id },
        data: {
          status:     newStatus,
          // Rejected annotations lose platform-wide visibility
          ...(body.action === "reject" ? { visibility: "tenant" } : {}),
        },
        select: { id: true, status: true, title: true },
      });

      await fastify.audit(request, {
        action:       `annotation.${body.action === "approve" ? "moderation_approved" : "moderation_rejected"}`,
        resourceType: "annotation",
        resourceId:   id,
        oldValues:    { status: annotation.status },
        newValues:    {
          status:      newStatus,
          action:      body.action,
          reviewNotes: body.reviewNotes ?? null,
          moderatedBy: request.user.email,
        },
      });

      return reply.code(200).send(updated);
    }
  );
};
