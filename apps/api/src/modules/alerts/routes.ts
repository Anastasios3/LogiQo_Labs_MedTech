import type { FastifyPluginAsync } from "fastify";
import { createAlertSchema, listAlertsSchema, acknowledgeAlertSchema } from "@logiqo/shared";
import { sendEmail, alertAcknowledgedEmailHtml } from "../../lib/mailer.js";

// ── Severity rank lookup ──────────────────────────────────────────────────────
// Mirrors the CASE WHEN mapping in migration 004_alerts_severity_rank.sql.
// Used at write time so that the read path can ORDER BY severityRank DESC
// entirely inside Postgres — no Node.js heap sort, no full-table load.
const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

// ── Plugin ────────────────────────────────────────────────────────────────────

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET /alerts — tenant-scoped alert feed ────────────────────────────────
  //
  // Fix 1 (scaling): DB-level ORDER BY severityRank DESC, publishedAt DESC
  //   via Prisma orderBy + skip/take.  The in-memory sort-then-paginate
  //   pattern has been removed entirely; Postgres handles ordering and
  //   cursor movement against the composite index added in migration 004.
  //
  // Fix 2 (serialization): affectedSkus is guarded with Array.isArray so
  //   the serializer never emits a raw db.Text string to the frontend if
  //   an ingest job somehow stores a scalar rather than a PostgreSQL array.
  //
  // Enrichment per row:
  //   affectedDeviceCount  — count of AlertDeviceLinks for this alert
  //   affectedDevices      — id / name / sku of linked devices
  //   acknowledged         — whether this tenant has acknowledged
  //   acknowledgedAt/By    — who and when (null if not yet acknowledged)
  //   isUnread             — convenience inverse of acknowledged
  //
  fastify.get("/", async (request) => {
    const query = listAlertsSchema.parse(request.query);
    const { page, limit, status, severity, type, source } = query;
    const offset   = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const acknowledged = status === "acknowledged";

    // Build Prisma where clause from optional filter params
    const where: Record<string, unknown> = {};
    if (severity) where.severity  = severity;
    if (type)     where.alertType = type;
    if (source)   where.source    = { contains: source, mode: "insensitive" };

    // Tenant-scoped acknowledgement filter
    where.tenantAlertAcknowledgements = acknowledged
      ? { some: { tenantId } }
      : { none: { tenantId } };

    // Issue count + page in parallel — both use the same where clause
    const [alerts, total] = await Promise.all([
      fastify.db.alert.findMany({
        where,
        select: {
          id:           true,
          alertType:    true,
          source:       true,
          externalId:   true,
          title:        true,
          summary:      true,
          severity:     true,
          severityRank: true,
          affectedSkus: true,
          publishedAt:  true,
          expiresAt:    true,
          sourceUrl:    true,
          ingestedAt:   true,
          createdAt:    true,
          // Per-tenant acknowledgement — unique constraint guarantees at most one row
          tenantAlertAcknowledgements: {
            where:  { tenantId },
            select: {
              acknowledgedAt: true,
              notes:          true,
              acknowledgedBy: {
                select: { fullName: true, specialty: true },
              },
            },
          },
          // Affected device details
          alertDeviceLinks: {
            select: {
              device: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        // DB-level sort: critical first, then newest-first within each bucket.
        // Matched by the composite index alerts_severity_rank_published_at_idx.
        orderBy: [
          { severityRank: "desc" },
          { publishedAt:  "desc" },
        ],
        skip: offset,
        take: limit,
      }),
      fastify.db.alert.count({ where }),
    ]);

    // Serialize — no in-memory sort needed
    const data = alerts.map(a => {
      const ack = a.tenantAlertAcknowledgements[0] ?? null;
      return {
        id:                  a.id,
        alertType:           a.alertType,
        source:              a.source,
        externalId:          a.externalId,
        title:               a.title,
        summary:             a.summary,
        severity:            a.severity,
        // Fix 2: guard against a non-array coming back from a corrupt ingest run
        affectedSkus:        Array.isArray(a.affectedSkus) ? a.affectedSkus : [],
        publishedAt:         a.publishedAt.toISOString(),
        expiresAt:           a.expiresAt?.toISOString()   ?? null,
        sourceUrl:           a.sourceUrl,
        ingestedAt:          a.ingestedAt.toISOString(),
        createdAt:           a.createdAt.toISOString(),
        // Enriched fields
        affectedDeviceCount: a.alertDeviceLinks.length,
        affectedDevices:     a.alertDeviceLinks.map(l => l.device),
        acknowledged:        Boolean(ack),
        isUnread:            !ack,
        acknowledgedAt:      ack?.acknowledgedAt.toISOString() ?? null,
        acknowledgedBy:      ack?.acknowledgedBy ?? null,
      };
    });

    await fastify.audit(request, {
      action:       "alerts.listed",
      resourceType: "alert",
      newValues:    { status, severity, type, source, page },
    });

    return { data, total, page, limit };
  });

  // ── POST /alerts — create alert (system_admin only) ───────────────────────
  //
  // Fix 1 (scaling): severityRank is computed from body.severity at write time
  //   and stored on the row so the read path never needs a runtime sort.
  //
  // Fix 3 (lock contention): device-link creation replaced with a single
  //   tx.alertDeviceLink.createMany() call. The transaction now holds exactly
  //   two statements regardless of affectedSkus length (max 500 per schema),
  //   eliminating the per-SKU lock acquisition that previously created
  //   contention under concurrent ingestion runs.
  //
  fastify.post("/", {
    preHandler: fastify.requireRole("system_admin"),
  }, async (request, reply) => {
    const body = createAlertSchema.parse(request.body);
    const now  = new Date();

    const { created, affectedDeviceCount } = await fastify.db.$transaction(async tx => {
      // Statement 1 of 2: create the alert with its denormalized rank
      const created = await tx.alert.create({
        data: {
          title:        body.title,
          summary:      body.summary,
          alertType:    body.alertType,
          severity:     body.severity,
          // Denormalized rank — keeps the read path off Node.js and on Postgres
          severityRank: SEVERITY_RANK[body.severity] ?? 1,
          source:       body.source,
          sourceUrl:    body.sourceUrl,
          externalId:   body.externalId,
          affectedSkus: body.affectedSkus,
          publishedAt:  body.publishedAt ? new Date(body.publishedAt) : now,
          expiresAt:    body.expiresAt   ? new Date(body.expiresAt)   : undefined,
          ingestedAt:   now,
        },
      });

      // Resolve all matching devices in a single read
      const devices = await tx.device.findMany({
        where:  { sku: { in: body.affectedSkus } },
        select: { id: true, sku: true },
      });

      // Statement 2 of 2: bulk-insert all links in one round-trip.
      // skipDuplicates guards against a race if the same alert is submitted
      // twice concurrently (e.g., from an ingestion worker retry).
      if (devices.length > 0) {
        await tx.alertDeviceLink.createMany({
          data: devices.map(d => ({
            alertId:     created.id,
            deviceId:    d.id,
            matchMethod: "sku_exact",
          })),
          skipDuplicates: true,
        });
      }

      return { created, affectedDeviceCount: devices.length };
    });

    await fastify.audit(request, {
      action:       "alert.created",
      resourceType: "alert",
      resourceId:   created.id,
      newValues: {
        alertType:           body.alertType,
        severity:            body.severity,
        source:              body.source,
        affectedSkus:        body.affectedSkus,
        affectedDeviceCount,
      },
    });

    return reply.code(201).send({
      alertId:             created.id,
      affectedDeviceCount,
      title:               created.title,
      severity:            created.severity,
      alertType:           created.alertType,
      publishedAt:         created.publishedAt.toISOString(),
      createdAt:           created.createdAt.toISOString(),
    });
  });

  // ── POST /alerts/:id/acknowledge ──────────────────────────────────────────
  //
  // Requires hospital_safety_officer or system_admin role.
  //
  // Production fix from previous session: resolves Auth0 sub → internal DB
  // UUID before writing acknowledgedById (the original stub wrote the Auth0
  // string directly into a @db.Uuid column, causing a Prisma runtime error).
  //
  // Returns 200 with { alertId, alertTitle, acknowledgedAt, notes } rather
  // than the original 204 (spec requires a response body).
  //
  fastify.post<{ Params: { id: string } }>("/:id/acknowledge", {
    preHandler: fastify.requireRole("hospital_safety_officer", "system_admin"),
  }, async (request, reply) => {
    const body     = acknowledgeAlertSchema.parse(request.body);
    const tenantId = request.user.tenantId;
    const alertId  = request.params.id;

    // ── 1. Resolve Auth0 sub → internal DB UUID ───────────────────────────
    const dbUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, fullName: true, email: true },
    });
    if (!dbUser) {
      return reply.code(401).send({ message: "Authenticated user not found in database." });
    }

    // ── 2. Verify alert exists ─────────────────────────────────────────────
    const alert = await fastify.db.alert.findUnique({
      where:  { id: alertId },
      select: { id: true, title: true, alertType: true, severity: true },
    });
    if (!alert) {
      return reply.code(404).send({ message: "Alert not found." });
    }

    // ── 3. Idempotency — one acknowledgement per tenant per alert ─────────
    const existing = await fastify.db.tenantAlertAcknowledgement.findUnique({
      where: { alertId_tenantId: { alertId, tenantId } },
    });
    if (existing) {
      return reply.code(409).send({
        message: "This alert has already been acknowledged by your organisation.",
      });
    }

    // ── 4. Persist acknowledgement ─────────────────────────────────────────
    const ack = await fastify.db.tenantAlertAcknowledgement.create({
      data: {
        alertId,
        tenantId,
        acknowledgedById: dbUser.id,   // ← DB UUID, never the Auth0 sub string
        notes:            body.notes,
      },
      select: { acknowledgedAt: true, notes: true },
    });

    // ── 5. Email confirmation (never throws — errors are logged only) ──────
    if (dbUser.email) {
      await sendEmail(
        {
          to:      dbUser.email,
          subject: `Alert Acknowledged: ${alert.title}`,
          html:    alertAcknowledgedEmailHtml({
            recipientName:  dbUser.fullName ?? "Safety Officer",
            alertTitle:     alert.title,
            alertType:      alert.alertType,
            severity:       alert.severity,
            acknowledgedAt: ack.acknowledgedAt,
            notes:          body.notes,
            alertUrl:       process.env.NEXT_PUBLIC_APP_URL
              ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/alerts`
              : undefined,
          }),
        },
        fastify.log,
      );
    }

    // ── 6. Audit log ───────────────────────────────────────────────────────
    await fastify.audit(request, {
      action:       "alert.acknowledged",
      resourceType: "alert",
      resourceId:   alertId,
      newValues: {
        tenantId,
        acknowledgedById: dbUser.id,
        alertTitle:       alert.title,
        notes:            body.notes ?? null,
      },
    });

    return reply.code(200).send({
      alertId,
      alertTitle:     alert.title,
      acknowledgedAt: ack.acknowledgedAt.toISOString(),
      notes:          ack.notes ?? null,
    });
  });
};
