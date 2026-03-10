import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const auditQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
});

const rejectBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require safety officer or system admin role
  fastify.addHook(
    "preHandler",
    fastify.requireRole("hospital_safety_officer", "system_admin")
  );

  // GET /admin/audit-logs
  fastify.get("/audit-logs", async (request) => {
    const query = auditQuerySchema.parse(request.query);
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const tenantId = request.user.tenantId;

    const [logs, total] = await Promise.all([
      fastify.db.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      fastify.db.auditLog.count({ where: { tenantId } }),
    ]);

    return { data: logs, total, page, limit };
  });

  // POST /admin/devices/:id/approve
  fastify.post<{ Params: { id: string } }>(
    "/devices/:id/approve",
    async (request, reply) => {
      const device = await fastify.db.device.findUnique({
        where: { id: request.params.id },
        select: { id: true, approvalStatus: true, name: true },
      });

      if (!device) return reply.code(404).send({ message: "Device not found" });
      if (device.approvalStatus !== "pending") {
        return reply
          .code(409)
          .send({ message: `Device is already ${device.approvalStatus}` });
      }

      const updated = await fastify.db.device.update({
        where: { id: request.params.id },
        data: {
          approvalStatus: "approved",
          approvedById: request.user.sub,
          approvedAt: new Date(),
        },
      });

      await fastify.audit(request, {
        action: "device.approved",
        resourceType: "device",
        resourceId: device.id,
        oldValues: { approvalStatus: "pending" },
        newValues: { approvalStatus: "approved", approvedBy: request.user.email },
      });

      return updated;
    }
  );

  // POST /admin/devices/:id/reject
  fastify.post<{ Params: { id: string } }>(
    "/devices/:id/reject",
    async (request, reply) => {
      const body = rejectBodySchema.parse(request.body);

      const device = await fastify.db.device.findUnique({
        where: { id: request.params.id },
        select: { id: true, approvalStatus: true },
      });

      if (!device) return reply.code(404).send({ message: "Device not found" });

      await fastify.db.device.update({
        where: { id: request.params.id },
        data: { approvalStatus: "rejected" },
      });

      await fastify.audit(request, {
        action: "device.rejected",
        resourceType: "device",
        resourceId: device.id,
        oldValues: { approvalStatus: device.approvalStatus },
        newValues: { approvalStatus: "rejected", reason: body.reason },
      });

      return reply.code(204).send();
    }
  );
};
