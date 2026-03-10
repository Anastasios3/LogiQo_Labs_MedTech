import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPresignedDownloadUrl } from "../../lib/s3.js";

const searchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const devicesRoutes: FastifyPluginAsync = async (fastify) => {
  // All device routes require authentication
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /devices — search and list
  fastify.get("/", async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const { q, category, manufacturer, page, limit } = query;
    const offset = (page - 1) * limit;

    // Build PostgreSQL full-text search via Prisma raw query for MVP
    const whereClause: Record<string, unknown> = {
      isActive: true,
    };

    if (category) whereClause.categoryId = category;

    if (manufacturer) {
      whereClause.manufacturer = { slug: manufacturer };
    }

    const [devices, total] = await Promise.all([
      fastify.db.device.findMany({
        where: whereClause,
        include: {
          manufacturer: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true } },
        },
        skip: offset,
        take: limit,
        orderBy: q ? undefined : { createdAt: "desc" },
      }),
      fastify.db.device.count({ where: whereClause }),
    ]);

    await fastify.audit(request, {
      action: "devices.searched",
      resourceType: "device",
      newValues: { query: q, category, manufacturer },
    });

    return { data: devices, total, page, limit };
  });

  // GET /devices/:id — device detail
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request, reply) => {
      const device = await fastify.db.device.findUnique({
        where: { id: request.params.id, isActive: true },
        include: {
          manufacturer: true,
          category: true,
          documents: {
            where: { isCurrent: true },
            select: {
              id: true,
              title: true,
              documentType: true,
              version: true,
              mimeType: true,
              fileSizeBytes: true,
              // Never return the s3Key directly
            },
          },
        },
      });

      if (!device) return reply.code(404).send({ message: "Device not found" });

      await fastify.audit(request, {
        action: "device.viewed",
        resourceType: "device",
        resourceId: device.id,
      });

      return device;
    }
  );

  // GET /devices/:id/documents/:documentId/url — pre-signed download URL
  fastify.get<{ Params: { id: string; documentId: string } }>(
    "/:id/documents/:documentId/url",
    async (request, reply) => {
      const doc = await fastify.db.deviceDocument.findFirst({
        where: {
          id: request.params.documentId,
          deviceId: request.params.id,
        },
        select: { id: true, s3Key: true, title: true },
      });

      if (!doc) return reply.code(404).send({ message: "Document not found" });

      const url = await getPresignedDownloadUrl(doc.s3Key);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await fastify.audit(request, {
        action: "document.downloaded",
        resourceType: "device_document",
        resourceId: doc.id,
        newValues: { documentTitle: doc.title },
      });

      return { url, expiresAt };
    }
  );
};
