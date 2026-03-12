import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { annotationFeedQuerySchema } from "@logiqo/shared";
import { telemetryRoutes } from "./telemetry-routes.js";

// ── Validation schemas ────────────────────────────────────────────────────────
//
// The POST /annotations body accepts both "observationText" (spec name) and
// "body" (legacy/shared name) — observationText takes priority.
// All other fields match the shared createAnnotationSchema semantics but
// with Phase-6-tightened constraints (50–2000 chars, future-date rejection).
//

const createAnnotationSchema = z.object({
  deviceId:        z.string().uuid("Invalid device ID"),
  annotationType:  z.enum([
    "operational_friction",
    "failure_mode",
    "material_tolerance",
    "tooling_anomaly",
    "general_observation",
  ]),
  severity:        z.enum(["low", "medium", "high", "critical"]).optional(),
  title:           z.string().min(5).max(200).trim(),
  // Accept "observationText" (spec) or "body" (legacy). observationText wins.
  observationText: z.string().min(50).max(2000).trim().optional(),
  body:            z.string().min(50).max(2000).trim().optional(),
  procedureType:   z.string().max(200).trim().optional(),
  /** ISO date string YYYY-MM-DD — stored as date only (minimise PHI) */
  procedureDate:   z.string().date().optional(),
  /** Aggregate count only — never individual patient identifiers */
  patientCount:    z.number().int().positive().optional(),
  visibility:      z.enum(["tenant", "platform"]).default("tenant"),
  structuredData:  z.record(z.unknown()).optional(),
  tags:            z.array(z.string().max(80)).max(10).optional(),
}).refine(
  (data) => Boolean(data.observationText ?? data.body),
  { message: "observationText (or body) is required", path: ["observationText"] },
);

const deviceAnnotationsQuerySchema = z.object({
  severity:   z.enum(["low", "medium", "high", "critical"]).optional(),
  visibility: z.enum(["tenant", "platform"]).optional(),
  sortBy:     z.enum(["recent", "endorsed", "severity"]).default("recent"),
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(100).default(20),
});

// ── Severity sort order ───────────────────────────────────────────────────────
const SEVERITY_ORDER: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

/**
 * Tier multiplier for vote scoring:
 *   0 → 0, 1 → 0, 2 → 1.0, 3 → 1.5
 */
function tierMultiplier(tier: number): number {
  if (tier <= 1) return 0;
  if (tier === 2) return 1.0;
  return 1.5;
}

/**
 * Compute annotation score from votes + engagement:
 *   score = Σ (value × specialtyRelevanceScore × tierMultiplier(voter.tier))
 *         + (commentCount × 0.1) + (endorsementCount × 0.5)
 */
function computeScore(votes: any[], commentCount: number, endorsementCount: number): number {
  const voteScore = votes.reduce((sum: number, v: any) => {
    return sum + v.value * v.specialtyRelevanceScore * tierMultiplier(v.user?.verificationTier ?? 0);
  }, 0);
  return voteScore + commentCount * 0.1 + endorsementCount * 0.5;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const annotationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // Register telemetry sub-routes (votes, comments, flags, tags, endorsements)
  await fastify.register(telemetryRoutes, { prefix: "/" });

  // ── GET /annotations — ranked / sorted annotation feed ───────────────────────
  fastify.get("/", async (request) => {
    const query    = annotationFeedQuerySchema.parse(request.query);
    const { deviceId, sort, tag, type, severity, page, limit } = query;
    const offset   = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const where: any = {
      status: "published",
      OR: [
        { visibility: "platform" as const },
        { tenantId },
      ],
    };

    if (deviceId) where.deviceId = deviceId;
    if (type)     where.annotationType = type;
    if (severity) where.severity = severity;
    if (tag) {
      where.tags = {
        some: { tag: { slug: tag } },
      };
    }

    // Run all tenant-scoped queries inside withTenant so the PostgreSQL
    // RLS variable (app.current_tenant_id) is set for the duration of
    // the transaction. This enforces DB-level tenant isolation.
    const { annotations, userId } = await fastify.withTenant(tenantId, async (tx) => {
      // Use explicit select (not include) so that authorId is never loaded
      // into the Node.js heap for anonymized annotations — the UUID is
      // therefore absent from Pino error serializations and APM traces.
      const annotations = await tx.annotation.findMany({
        where,
        select: {
          id:               true,
          deviceId:         true,
          tenantId:         true,
          annotationType:   true,
          severity:         true,
          title:            true,
          body:             true,
          procedureType:    true,
          procedureDate:    true,
          patientCount:     true,
          visibility:       true,
          status:           true,
          publishedAt:      true,
          isPublished:      true,
          isAnonymized:     true,
          version:          true,
          parentId:         true,
          endorsementCount: true,
          flagCount:        true,
          createdAt:        true,
          // authorId intentionally omitted — UUID never loaded for anonymized rows
          author: {
            select: { id: true, fullName: true, specialty: true, verificationTier: true },
          },
          device: {
            select: { id: true, name: true, sku: true },
          },
          // Only fields needed for score computation and userVote lookup
          votes: {
            select: {
              userId:                  true,
              value:                   true,
              specialtyRelevanceScore: true,
              user: { select: { verificationTier: true } },
            },
          },
          _count: {
            select: { annotationEndorsements: true, comments: true },
          },
          tags: {
            select: {
              annotationId: true,
              tagId:        true,
              tag: { select: { id: true, name: true, slug: true, category: true } },
            },
          },
        },
      });

      // Resolve requesting user inside the same tx (same tenant context)
      const dbUser = await tx.user.findUnique({
        where:  { auth0UserId: request.user.sub },
        select: { id: true },
      });

      return { annotations, userId: dbUser?.id };
    });

    // Compute scores in memory (acceptable for ≤ 10k annotations)
    type AnnotationItem = typeof annotations[0];
    type WithScore = AnnotationItem & { _score: number };

    const withScores: WithScore[] = annotations.map(a => ({
      ...a,
      _score: computeScore(
        a.votes as any[],
        a._count.comments,
        a._count.annotationEndorsements,
      ),
    }));

    // Sort
    let sorted: WithScore[];
    switch (sort) {
      case "top":
        sorted = withScores.sort((a, b) => b._score - a._score);
        break;
      case "discussed":
        sorted = withScores.sort((a, b) => b._count.comments - a._count.comments);
        break;
      case "newest":
      default:
        sorted = withScores.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }

    // Paginate — get the page slice first so we can batch-resolve endorsements
    const pageAnnotations = sorted.slice(offset, offset + limit);
    const pageIds         = pageAnnotations.map(a => a.id);

    // Batch-resolve userHasEndorsed: single query for the page, not one per row.
    // Builds a Set<annotationId> for O(1) lookup per annotation in the map below.
    const endorsedSet = new Set<string>();
    if (userId && pageIds.length > 0) {
      const endorsements = await fastify.db.annotationEndorsement.findMany({
        where:  { userId, annotationId: { in: pageIds } },
        select: { annotationId: true },
      });
      for (const e of endorsements) endorsedSet.add(e.annotationId);
    }

    // Serialize — authorId is NOT on the annotation object (excluded from select),
    // so the UUID never appears in the response body for anonymized rows.
    const pageSlice = pageAnnotations.map(a => ({
      id:               a.id,
      deviceId:         a.deviceId,
      tenantId:         a.tenantId,
      annotationType:   a.annotationType,
      severity:         a.severity,
      title:            a.title,
      body:             a.body,
      procedureType:    a.procedureType,
      procedureDate:    a.procedureDate ? a.procedureDate.toISOString().split("T")[0] : null,
      patientCount:     a.patientCount,
      visibility:       a.visibility,
      status:           a.status,
      publishedAt:      a.publishedAt?.toISOString() ?? null,
      isPublished:      a.isPublished,
      version:          a.version,
      parentId:         a.parentId,
      endorsementCount: a.endorsementCount,
      flagCount:        a.flagCount,
      // Anonymized rows: return no id field — author UUID is stripped entirely
      author:           a.isAnonymized
        ? { fullName: "Anonymous", specialty: null, verificationTier: 0 }
        : a.author,
      device:           a.device,
      commentCount:     a._count.comments,
      voteScore:        a._score,
      userHasEndorsed:  endorsedSet.has(a.id),
      userVote:         userId
        ? ((a.votes as any[]).find((v: any) => v.userId === userId)?.value ?? 0)
        : 0,
      tags:             a.tags,
      createdAt:        a.createdAt.toISOString(),
    }));

    await fastify.audit(request, {
      action:       "annotations.feed.listed",
      resourceType: "annotation",
      newValues:    { sort, deviceId, tag, page },
    });

    return {
      data:  pageSlice,
      total: sorted.length,
      page,
      limit,
    };
  });

  // ── POST /annotations — create annotation (tier 2+ clinicians only) ───────────
  //
  // Phase 6 changes vs original:
  //   • Accepts "observationText" field (spec name) or "body" (legacy)
  //   • Validates: observationText 50–2000 chars, procedureDate not in future
  //   • Creates with status="published" + isPublished=true + publishedAt=now()
  //   • Increments Device.annotationCount atomically in the same transaction
  //
  fastify.post("/", async (request, reply) => {
    const user = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, verificationTier: true, tenantId: true },
    });

    // Tier 2+ required (NPI validated)
    if (!user || user.verificationTier < 2) {
      return reply.code(403).send({
        message:
          "NPI-verified clinicians (tier 2+) may submit annotations. " +
          "Complete NPI verification in your profile settings.",
      });
    }

    const body = createAnnotationSchema.parse(request.body);

    // Validate: procedureDate must not be in the future
    if (body.procedureDate) {
      const pd = new Date(body.procedureDate);
      pd.setHours(23, 59, 59, 999); // allow today
      if (pd > new Date()) {
        return reply.code(422).send({
          message: "procedureDate cannot be a future date.",
        });
      }
    }

    // Resolve observation text — observationText takes priority over body
    const observationText = (body.observationText ?? body.body)!;

    const annotation = await fastify.db.$transaction(async tx => {
      const now = new Date();

      const created = await tx.annotation.create({
        data: {
          deviceId:       body.deviceId,
          tenantId:       request.user.tenantId,
          authorId:       user.id,
          annotationType: body.annotationType,
          severity:       body.severity,
          title:          body.title,
          body:           observationText,
          procedureType:  body.procedureType,
          procedureDate:  body.procedureDate ? new Date(body.procedureDate) : undefined,
          patientCount:   body.patientCount,
          visibility:     body.visibility,
          structuredData: body.structuredData as any,
          // Phase 6: published immediately (no moderation queue for tier 2+)
          isPublished:    true,
          status:         "published",
          publishedAt:    now,
          version:        1,
        },
      });

      // Attach tags if provided
      if (body.tags?.length) {
        for (const slug of body.tags) {
          const tag = await tx.annotationTag.upsert({
            where:  { slug },
            create: { name: slug.replace(/-/g, " "), slug, category: "device_type" },
            update: {},
          });
          await tx.annotationTagLink.create({
            data: { annotationId: created.id, tagId: tag.id },
          });
        }
      }

      // Increment denormalized annotationCount on the device
      await tx.device.update({
        where: { id: body.deviceId },
        data:  { annotationCount: { increment: 1 } },
      });

      return created;
    });

    await fastify.audit(request, {
      action:       "annotation.created",
      resourceType: "annotation",
      resourceId:   annotation.id,
      newValues: {
        deviceId:       body.deviceId,
        annotationType: body.annotationType,
        severity:       body.severity,
        status:         "published",
      },
    });

    return reply.code(201).send({
      annotationId:    annotation.id,
      status:          annotation.status,
      publishedAt:     annotation.publishedAt?.toISOString(),
      annotationType:  annotation.annotationType,
      severity:        annotation.severity,
      title:           annotation.title,
      visibility:      annotation.visibility,
      version:         annotation.version,
      createdAt:       annotation.createdAt.toISOString(),
    });
  });
};
