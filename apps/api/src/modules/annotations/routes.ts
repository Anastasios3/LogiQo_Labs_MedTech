import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createAnnotationSchema = z.object({
  deviceId: z.string().uuid(),
  annotationType: z.enum([
    "operational_friction",
    "failure_mode",
    "material_tolerance",
    "tooling_anomaly",
    "general_observation",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  title: z.string().min(5).max(200),
  body: z.string().min(20).max(10000),
  procedureType: z.string().max(200).optional(),
  procedureDate: z.string().date().optional(),
  patientCount: z.number().int().positive().optional(),
  visibility: z.enum(["tenant", "platform"]).default("tenant"),
  structuredData: z.record(z.unknown()).optional(),
});

export const annotationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /annotations — list annotations for a device
  fastify.get<{ Querystring: { deviceId?: string } }>(
    "/",
    async (request, reply) => {
      const deviceId = (request.query as { deviceId?: string }).deviceId;
      if (!deviceId) {
        return reply.code(400).send({ message: "deviceId is required" });
      }

      const annotations = await fastify.db.annotation.findMany({
        where: {
          deviceId,
          isPublished: true,
          OR: [
            { visibility: "platform" },
            { tenantId: request.user.tenantId },
          ],
        },
        include: {
          author: {
            select: { id: true, fullName: true, specialty: true },
          },
          _count: { select: { annotationEndorsements: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      await fastify.audit(request, {
        action: "annotations.listed",
        resourceType: "annotation",
        newValues: { deviceId },
      });

      return { data: annotations };
    }
  );

  // POST /annotations — create annotation (verified clinicians only)
  fastify.post("/", async (request, reply) => {
    // Check clinician verification status
    const user = await fastify.db.user.findUnique({
      where: { auth0UserId: request.user.sub },
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
        deviceId: body.deviceId,
        tenantId: request.user.tenantId,
        authorId: user.id,
        annotationType: body.annotationType,
        severity: body.severity,
        title: body.title,
        body: body.body,
        procedureType: body.procedureType,
        procedureDate: body.procedureDate
          ? new Date(body.procedureDate)
          : undefined,
        patientCount: body.patientCount,
        visibility: body.visibility,
        structuredData: body.structuredData,
        isPublished: false, // Requires moderation review before publication
        version: 1,
      },
    });

    await fastify.audit(request, {
      action: "annotation.created",
      resourceType: "annotation",
      resourceId: annotation.id,
      newValues: {
        deviceId: body.deviceId,
        annotationType: body.annotationType,
        severity: body.severity,
      },
    });

    return reply.code(201).send(annotation);
  });
};
