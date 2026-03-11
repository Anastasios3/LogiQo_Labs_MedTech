import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { annotationFeedQuerySchema } from "@logiqo/shared";
import { telemetryRoutes } from "./telemetry-routes.js";

const createAnnotationSchema = z.object({
  deviceId:       z.string().uuid(),
  annotationType: z.enum([
    "operational_friction",
    "failure_mode",
    "material_tolerance",
    "tooling_anomaly",
    "general_observation",
  ]),
  severity:       z.enum(["low", "medium", "high", "critical"]).optional(),
  title:          z.string().min(5).max(200),
  body:           z.string().min(20).max(10000),
  procedureType:  z.string().max(200).optional(),
  procedureDate:  z.string().date().optional(),
  patientCount:   z.number().int().positive().optional(),
  visibility:     z.enum(["tenant", "platform"]).default("tenant"),
  structuredData: z.record(z.unknown()).optional(),
  tags:           z.array(z.string().max(80)).max(10).optional(),
});

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

export const annotationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // Register telemetry sub-routes (votes, comments, flags, tags)
  await fastify.register(telemetryRoutes, { prefix: "/" });

  // ── GET /annotations — ranked / sorted annotation feed ───────────────────────
  fastify.get("/", async (request) => {
    const query    = annotationFeedQuerySchema.parse(request.query);
    const { deviceId, sort, tag, type, severity, page, limit } = query;
    const offset   = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const where: any = {
      isPublished: true,
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
      const annotations = await tx.annotation.findMany({
        where,
        include: {
          author: {
            select: { id: true, fullName: true, specialty: true, verificationTier: true },
          },
          device: {
            select: { id: true, name: true, sku: true },
          },
          votes: {
            include: { user: { select: { verificationTier: true } } },
          },
          _count: {
            select: { annotationEndorsements: true, comments: true },
          },
          tags: {
            include: { tag: { select: { id: true, name: true, slug: true, category: true } } },
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

    // Paginate + clean up internal fields
    const pageSlice = sorted.slice(offset, offset + limit).map(a => ({
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
      isPublished:      a.isPublished,
      version:          a.version,
      parentId:         a.parentId,
      author:           a.isAnonymized
        ? { id: a.author?.id, fullName: "Anonymous", specialty: null, verificationTier: 0 }
        : a.author,
      device:           a.device,
      endorsementCount: a._count.annotationEndorsements,
      commentCount:     a._count.comments,
      voteScore:        a._score,
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
  fastify.post("/", async (request, reply) => {
    const user = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, verificationTier: true, tenantId: true },
    });

    // Tier 2+ required (NPI validated) — replaces old isVerifiedClinician boolean
    if (!user || user.verificationTier < 2) {
      return reply.code(403).send({
        message:
          "NPI-verified clinicians (tier 2+) may submit annotations. " +
          "Complete NPI verification in your profile settings.",
      });
    }

    const body = createAnnotationSchema.parse(request.body);

    const annotation = await fastify.db.$transaction(async tx => {
      const created = await tx.annotation.create({
        data: {
          deviceId:       body.deviceId,
          tenantId:       request.user.tenantId,
          authorId:       user.id,
          annotationType: body.annotationType,
          severity:       body.severity,
          title:          body.title,
          body:           body.body,
          procedureType:  body.procedureType,
          procedureDate:  body.procedureDate ? new Date(body.procedureDate) : undefined,
          patientCount:   body.patientCount,
          visibility:     body.visibility,
          structuredData: body.structuredData as any,
          isPublished:    false, // Requires moderation review
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
      },
    });

    return reply.code(201).send(annotation);
  });
};
