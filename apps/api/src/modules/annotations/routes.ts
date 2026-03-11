import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

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
});

const listQuerySchema = z.object({
  deviceId: z.string().uuid().optional(),
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(100).default(20),
});

export const annotationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET /annotations — list annotations (feed or device-specific) ────────────
  // If deviceId is provided: return published annotations for that device.
  // If omitted:              return a platform-wide feed of recent annotations.
  fastify.get("/", async (request) => {
    const query    = listQuerySchema.parse(request.query);
    const { deviceId, page, limit } = query;
    const offset   = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const where = deviceId
      ? {
          deviceId,
          isPublished: true,
          OR: [
            { visibility: "platform" as const },
            { tenantId },
          ],
        }
      : {
          isPublished: true,
          OR: [
            { visibility: "platform" as const },
            { tenantId },
          ],
        };

    const [annotations, total] = await Promise.all([
      fastify.db.annotation.findMany({
        where,
        include: {
          author: {
            select: { id: true, fullName: true, specialty: true },
          },
          device: {
            select: { id: true, name: true, sku: true },
          },
          _count: { select: { annotationEndorsements: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:    offset,
        take:    limit,
      }),
      fastify.db.annotation.count({ where }),
    ]);

    await fastify.audit(request, {
      action:       "annotations.listed",
      resourceType: "annotation",
      newValues:    { deviceId: deviceId ?? "feed" },
    });

    return { data: annotations, total, page, limit };
  });

  // ── POST /annotations — create annotation (verified clinicians only) ──────────
  fastify.post("/", async (request, reply) => {
    // Check clinician verification
    const user = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, isVerifiedClinician: true },
    });

    if (!user?.isVerifiedClinician) {
      return reply.code(403).send({
        message:
          "Only verified clinicians can submit annotations. Contact your administrator.",
      });
    }

    const body = createAnnotationSchema.parse(request.body);

    const annotation = await fastify.db.annotation.create({
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
        isPublished:    false, // Requires moderation review before publication
        version:        1,
      },
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
