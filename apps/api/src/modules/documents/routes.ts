import type { FastifyPluginAsync } from "fastify";
import { getPresignedDownloadUrl } from "../../lib/s3.js";

/**
 * Top-level /documents routes.
 *
 * Unlike the /devices/:id/documents/:documentId/url endpoint (which requires
 * the caller to know both deviceId and documentId), this module exposes a
 * shortcut that only needs the documentId.  Useful when the frontend stores
 * only document IDs (e.g. in annotations or alert links) and doesn't want to
 * first look up which device a document belongs to.
 *
 * Authentication + subscription gate are inherited from the protectedRoutes
 * scope in server.ts — no additional auth hooks needed here.
 */
export const documentsRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /documents/:id/view — generate a 15-min pre-signed download URL ───────
  //
  // Returns a temporary S3 URL along with document metadata.
  // The s3Key is never exposed — only the pre-signed URL is returned.
  //
  // Audit fields recorded:
  //   userId, tenantId (from request.user — populated by authPlugin)
  //   documentId, deviceId, ipAddress, accessedAt
  //
  fastify.get<{ Params: { id: string } }>(
    "/:id/view",
    async (request, reply) => {
      const { id } = request.params;

      const doc = await fastify.db.deviceDocument.findFirst({
        where:  { id, isCurrent: true },
        select: {
          id:       true,
          s3Key:    true,
          title:    true,
          mimeType: true,
          deviceId: true,
          documentType: true,
        },
      });

      if (!doc) return reply.code(404).send({ message: "Document not found" });

      const url       = await getPresignedDownloadUrl(doc.s3Key);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Immutable audit trail — records every time a user generates a view URL.
      // ipAddress is captured for HIPAA audit log completeness (access tracking).
      await fastify.audit(request, {
        action:       "document.viewed",
        resourceType: "device_document",
        resourceId:   doc.id,
        newValues:    {
          documentTitle: doc.title,
          documentType:  doc.documentType,
          deviceId:      doc.deviceId,
          ipAddress:     request.ip,
          accessedAt:    new Date().toISOString(),
        },
      });

      return {
        url,
        expiresAt,
        title:        doc.title,
        mimeType:     doc.mimeType,
        documentType: doc.documentType,
        deviceId:     doc.deviceId,
      };
    }
  );
};
