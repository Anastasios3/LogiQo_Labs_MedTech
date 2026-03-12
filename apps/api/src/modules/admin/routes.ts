import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";

// ── Validation schemas ────────────────────────────────────────────────────────

const auditQuerySchema = z.object({
  page:  z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
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

// ── Plugin ────────────────────────────────────────────────────────────────────

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require safety officer or system admin role
  fastify.addHook(
    "preHandler",
    fastify.requireRole("hospital_safety_officer", "system_admin")
  );

  // ── GET /admin/stats — operational dashboard counts ───────────────────────────
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

  // ── GET /admin/devices/pending — devices awaiting approval ────────────────────
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

  // ── POST /admin/devices — create a new device (both admin roles) ──────────────
  //
  // Separate from POST /devices (system_admin only).
  // Safety officers also need to create devices in the approval pipeline.
  // Newly created devices start with approvalStatus: "pending" — the creator
  // (or another officer) still needs to approve via the approve endpoint.
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

  // ── GET /admin/audit-logs ─────────────────────────────────────────────────────
  fastify.get("/audit-logs", async (request) => {
    const query    = auditQuerySchema.parse(request.query);
    const { page, limit } = query;
    const offset   = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const [logs, total] = await Promise.all([
      fastify.db.auditLog.findMany({
        where:   { tenantId },
        orderBy: { createdAt: "desc" },
        skip:    offset,
        take:    limit,
      }),
      fastify.db.auditLog.count({ where: { tenantId } }),
    ]);

    return { data: logs, total, page, limit };
  });

  // ── Shared approve/reject logic ───────────────────────────────────────────────
  //
  // Both POST (legacy) and PATCH are supported:
  //   POST  /admin/devices/:id/approve  — original endpoint (kept for back-compat)
  //   PATCH /admin/devices/:id/approve  — RESTful alias (frontend uses this)
  //   POST  /admin/devices/:id/reject   — original endpoint
  //   PATCH /admin/devices/:id/reject   — RESTful alias
  //
  // Shared logic is extracted as inner closures that close over `fastify` so the
  // request/reply types are the plain Fastify base types — the module-augmented
  // `request.user` is available because the auth plugin's `declare module "fastify"`
  // widens FastifyRequest globally in this compilation unit.
  //

  // ── Helper: SCAN + DEL all device_search:* keys ─────────────────────────────
  // Called only on approval (pending→approved transitions the device into the
  // searchable set). SCAN is used instead of KEYS so each round-trip is O(1)
  // and the Redis event loop is never blocked, even with thousands of cached pages.
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

    // ── Fix: resolve Auth0 sub → internal users.id UUID ──────────────────────
    // request.user.sub is an Auth0 subject string (e.g. "auth0|abc123"), NOT a
    // Postgres UUID. Device.approvedById is a @db.Uuid FK → users.id.
    // Storing the sub directly would cause a FK violation or a silent phantom
    // join. We resolve the internal ID first; a missing record is a 403 (the
    // token is valid but the user has not been registered yet).
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
        approvedById:   approver.id,   // ← internal UUID, not Auth0 sub
        approvedAt:     new Date(),
      },
    });

    // Invalidate detail cache + all search result pages.
    // Search cache must be busted because approval transitions the device from
    // non-searchable (pending) to searchable (approved). Without this, the device
    // would be absent from search results for up to SEARCH_TTL (5 min).
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

    // Invalidate cached device detail
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

  // ── POST /admin/devices/:id/approve (legacy) ──────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/devices/:id/approve",
    async (request, reply) => handleApprove(request, reply)
  );

  // ── PATCH /admin/devices/:id/approve (RESTful alias) ─────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/devices/:id/approve",
    async (request, reply) => handleApprove(request, reply)
  );

  // ── POST /admin/devices/:id/reject (legacy) ───────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/devices/:id/reject",
    async (request, reply) => handleReject(request, reply)
  );

  // ── PATCH /admin/devices/:id/reject (RESTful alias) ──────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/devices/:id/reject",
    async (request, reply) => handleReject(request, reply)
  );
};
