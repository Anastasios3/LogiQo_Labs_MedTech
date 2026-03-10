import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

declare module "fastify" {
  interface FastifyInstance {
    audit: (request: FastifyRequest, entry: AuditEntry) => Promise<void>;
  }
}

const auditPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "audit",
    async (request: FastifyRequest, entry: AuditEntry) => {
      // The app_user DB role has INSERT + SELECT only on audit_logs.
      // Never UPDATE or DELETE.
      await fastify.db.auditLog.create({
        data: {
          userId: request.user?.sub ?? null,
          tenantId: request.user?.tenantId ?? null,
          userEmail: request.user?.email ?? null,
          userRole: request.user?.role ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          oldValues: entry.oldValues ?? undefined,
          newValues: entry.newValues ?? undefined,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
          requestId: request.id,
        },
      });
    }
  );
};

export const auditPlugin = fp(auditPluginImpl, { name: "audit" });
