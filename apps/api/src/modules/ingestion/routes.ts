import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ingestFdaRecalls } from "./ingest-fda-recalls.js";
import { ingestFda510k } from "./ingest-fda-510k.js";
import { testConnection as testGudid } from "../../lib/gudid-client.js";
import { testConnection as testEudamed } from "../../lib/eudamed-client.js";
import type { TenantDataSources } from "@logiqo/shared";

const runsQuerySchema = z.object({
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(50),
  source: z.string().optional(),
});

const settingsPatchSchema = z.object({
  fdaRecalls: z.object({
    enabled:       z.boolean(),
    syncFrequency: z.enum(["manual", "1h", "6h", "24h"]),
  }).optional(),
  fda510k: z.object({
    enabled:       z.boolean(),
    syncFrequency: z.enum(["manual", "1h", "6h", "24h"]),
  }).optional(),
  gudid: z.object({
    enabled:       z.boolean(),
    syncFrequency: z.enum(["manual", "1h", "6h", "24h"]),
  }).optional(),
  eudamed: z.object({
    enabled:       z.boolean(),
    syncFrequency: z.enum(["manual", "1h", "6h", "24h"]),
  }).optional(),
});

const DEFAULT_DATA_SOURCES: TenantDataSources = {
  fdaRecalls: { enabled: true,  syncFrequency: "24h" },
  fda510k:    { enabled: true,  syncFrequency: "24h" },
  gudid:      { enabled: true,  syncFrequency: "manual" },
  eudamed:    { enabled: false, syncFrequency: "manual" },
};

// ── Ingestion Routes — POST /ingestion/sync/* and GET /ingestion/runs ──────────

export const ingestionRoutes: FastifyPluginAsync = async (fastify) => {
  // Require safety officer or system admin for all ingestion actions
  fastify.addHook(
    "preHandler",
    fastify.requireRole("hospital_safety_officer", "system_admin"),
  );

  // ── POST /ingestion/sync/fda-recalls ─────────────────────────────────────────
  fastify.post("/sync/fda-recalls", async (request) => {
    const result = await ingestFdaRecalls(fastify.db, "manual", request.user.sub);

    await fastify.audit(request, {
      action:       "ingestion.fda_recalls.triggered",
      resourceType: "ingestion_run",
      resourceId:   result.runId,
      newValues:    {
        recordsIngested: result.recordsIngested,
        recordsSkipped:  result.recordsSkipped,
        errorMessage:    result.errorMessage,
      },
    });

    return result;
  });

  // ── POST /ingestion/sync/fda-510k ────────────────────────────────────────────
  fastify.post("/sync/fda-510k", async (request) => {
    const result = await ingestFda510k(fastify.db, "manual", request.user.sub);

    await fastify.audit(request, {
      action:       "ingestion.fda_510k.triggered",
      resourceType: "ingestion_run",
      resourceId:   result.runId,
      newValues:    {
        recordsIngested: result.recordsIngested,
        recordsSkipped:  result.recordsSkipped,
        errorMessage:    result.errorMessage,
      },
    });

    return result;
  });

  // ── POST /ingestion/sync/gudid-test ─────────────────────────────────────────
  fastify.post("/sync/gudid-test", async () => {
    return await testGudid();
  });

  // ── POST /ingestion/sync/eudamed-test ───────────────────────────────────────
  fastify.post("/sync/eudamed-test", async () => {
    return await testEudamed();
  });

  // ── GET /ingestion/runs ──────────────────────────────────────────────────────
  fastify.get("/runs", async (request) => {
    const query  = runsQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.limit;
    const where  = query.source ? { source: query.source } : {};

    const [runs, total] = await Promise.all([
      fastify.db.ingestionRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip:    offset,
        take:    query.limit,
      }),
      fastify.db.ingestionRun.count({ where }),
    ]);

    return { data: runs, total, page: query.page, limit: query.limit };
  });
};

// ── Settings Routes — GET /settings and PATCH /settings ──────────────────────

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET /settings ─────────────────────────────────────────────────────────────
  fastify.get("/", async (request) => {
    const { tenantId } = request.user;
    if (!tenantId) return DEFAULT_DATA_SOURCES;

    const tenant = await fastify.db.tenant.findUnique({
      where:  { id: tenantId },
      select: { settings: true },
    });

    const raw    = tenant?.settings as Record<string, unknown> | null;
    const ds     = raw?.dataSources as TenantDataSources | undefined;
    return ds ?? DEFAULT_DATA_SOURCES;
  });

  // ── PATCH /settings ──────────────────────────────────────────────────────────
  fastify.patch("/", async (request, reply) => {
    const { tenantId } = request.user;
    if (!tenantId) return reply.code(400).send({ message: "No tenant context" });

    const patch = settingsPatchSchema.parse(request.body);

    const tenant = await fastify.db.tenant.findUnique({
      where:  { id: tenantId },
      select: { settings: true },
    });

    const current   = (tenant?.settings as Record<string, unknown>) ?? {};
    const currentDS = (current.dataSources as TenantDataSources) ?? DEFAULT_DATA_SOURCES;
    const merged    = { ...currentDS, ...patch };

    await fastify.db.tenant.update({
      where: { id: tenantId },
      data:  { settings: { ...current, dataSources: merged } },
    });

    await fastify.audit(request, {
      action:       "settings.data_sources.updated",
      resourceType: "tenant",
      resourceId:   tenantId,
      newValues:    merged,
    });

    return merged;
  });
};
