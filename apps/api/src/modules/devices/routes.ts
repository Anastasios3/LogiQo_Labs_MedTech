import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPresignedDownloadUrl } from "../../lib/s3.js";

const searchQuerySchema = z.object({
  q:            z.string().optional(),
  category:     z.string().optional(),
  manufacturer: z.string().optional(),
  status:       z.enum(["approved", "recalled", "pending", "withdrawn"]).optional(),
  page:         z.coerce.number().min(1).default(1),
  limit:        z.coerce.number().min(1).max(100).default(20),
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
});

export const devicesRoutes: FastifyPluginAsync = async (fastify) => {
  // All device routes require authentication
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET /devices/meta — filter metadata (manufacturers + categories) ──────────
  fastify.get("/meta", async () => {
    const [manufacturers, categories] = await Promise.all([
      fastify.db.manufacturer.findMany({
        select:  { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
      fastify.db.deviceCategory.findMany({
        select:  { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { manufacturers, categories };
  });

  // ── GET /devices — search + list ─────────────────────────────────────────────
  fastify.get("/", async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const { q, category, manufacturer, status, page, limit } = query;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };

    if (q) {
      where.OR = [
        { name:        { contains: q, mode: "insensitive" } },
        { sku:         { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (category)     where.categoryId       = category;
    if (manufacturer) where.manufacturer     = { slug: manufacturer };
    if (status)       where.regulatoryStatus = status;

    const [devices, total] = await Promise.all([
      fastify.db.device.findMany({
        where: where as any,
        include: {
          manufacturer: { select: { id: true, name: true, slug: true } },
          category:     { select: { id: true, name: true } },
          _count:       { select: { annotations: true } },
        },
        skip:    offset,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
      fastify.db.device.count({ where: where as any }),
    ]);

    await fastify.audit(request, {
      action:       "devices.searched",
      resourceType: "device",
      newValues:    { query: q, category, manufacturer, status },
    });

    return { data: devices, total, page, limit };
  });

  // ── POST /devices — system admin: add device to index ────────────────────────
  fastify.post(
    "/",
    { preHandler: fastify.requireRole("system_admin") },
    async (request, reply) => {
      const body = createDeviceBodySchema.parse(request.body);

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
          sterilizationMethod: body.sterilizationMethod,
          fdA510kNumber:       body.fdA510kNumber,
          ceMmarkNumber:       body.ceMmarkNumber,
          approvalStatus:      "pending",
          isActive:            true,
        },
        include: {
          manufacturer: { select: { id: true, name: true, slug: true } },
          category:     { select: { id: true, name: true } },
        },
      });

      await fastify.audit(request, {
        action:       "device.created",
        resourceType: "device",
        resourceId:   device.id,
        newValues:    { sku: body.sku, name: body.name },
      });

      return reply.code(201).send(device);
    }
  );

  // ── GET /devices/:id — device detail ─────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request, reply) => {
      const device = await fastify.db.device.findUnique({
        where: { id: request.params.id, isActive: true },
        include: {
          manufacturer: true,
          category:     true,
          documents: {
            where:  { isCurrent: true },
            select: {
              id:            true,
              title:         true,
              documentType:  true,
              version:       true,
              mimeType:      true,
              fileSizeBytes: true,
            },
          },
          _count: { select: { annotations: true } },
        },
      });

      if (!device) return reply.code(404).send({ message: "Device not found" });

      await fastify.audit(request, {
        action:       "device.viewed",
        resourceType: "device",
        resourceId:   device.id,
      });

      return device;
    }
  );

  // ── GET /devices/:id/documents/:documentId/url — pre-signed download URL ─────
  fastify.get<{ Params: { id: string; documentId: string } }>(
    "/:id/documents/:documentId/url",
    async (request, reply) => {
      const doc = await fastify.db.deviceDocument.findFirst({
        where: {
          id:       request.params.documentId,
          deviceId: request.params.id,
        },
        select: { id: true, s3Key: true, title: true },
      });

      if (!doc) return reply.code(404).send({ message: "Document not found" });

      const url       = await getPresignedDownloadUrl(doc.s3Key);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await fastify.audit(request, {
        action:       "document.downloaded",
        resourceType: "device_document",
        resourceId:   doc.id,
        newValues:    { documentTitle: doc.title },
      });

      return { url, expiresAt };
    }
  );
};
