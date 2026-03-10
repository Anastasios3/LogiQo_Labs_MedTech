import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["active", "acknowledged"]).default("active"),
});

const acknowledgeBodySchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /alerts — list alerts for this tenant
  fastify.get("/", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const acknowledged = status === "acknowledged";

    const [alerts, total] = await Promise.all([
      fastify.db.alert.findMany({
        where: {
          // Filter to alerts that are acknowledged or not, based on tenant
          tenantAlertAcknowledgements: acknowledged
            ? { some: { tenantId } }
            : { none: { tenantId } },
        },
        orderBy: [{ severity: "asc" }, { publishedAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      fastify.db.alert.count({
        where: {
          tenantAlertAcknowledgements: acknowledged
            ? { some: { tenantId } }
            : { none: { tenantId } },
        },
      }),
    ]);

    return { data: alerts, total, page, limit };
  });

  // POST /alerts/:id/acknowledge
  fastify.post<{ Params: { id: string } }>(
    "/:id/acknowledge",
    {
      preHandler: fastify.requireRole(
        "hospital_safety_officer",
        "system_admin"
      ),
    },
    async (request, reply) => {
      const body = acknowledgeBodySchema.parse(request.body);
      const tenantId = request.user.tenantId;

      const existing = await fastify.db.tenantAlertAcknowledgement.findUnique({
        where: { alertId_tenantId: { alertId: request.params.id, tenantId } },
      });

      if (existing) {
        return reply.code(409).send({ message: "Alert already acknowledged" });
      }

      await fastify.db.tenantAlertAcknowledgement.create({
        data: {
          alertId: request.params.id,
          tenantId,
          acknowledgedById: request.user.sub,
          notes: body.notes,
        },
      });

      await fastify.audit(request, {
        action: "alert.acknowledged",
        resourceType: "alert",
        resourceId: request.params.id,
        newValues: { tenantId, notes: body.notes },
      });

      return reply.code(204).send();
    }
  );
};
