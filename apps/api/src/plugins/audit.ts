import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

export interface AuditEntry {
  action:       string;
  resourceType: string;
  resourceId?:  string;
  oldValues?:   Record<string, unknown>;
  newValues?:   Record<string, unknown>;
  /**
   * Override the actor fields when request.user is null.
   * Use for unauthenticated endpoints (e.g. POST /auth/register,
   * GET /auth/verify-email) where the acting subject is known from
   * application context but cannot be read from a JWT claim.
   */
  actorOverride?: {
    userId?:    string | null;
    tenantId?:  string | null;
    userEmail?: string | null;
    userRole?:  string | null;
  };
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
      // Never UPDATE or DELETE — enforced at DB level.
      await fastify.db.auditLog.create({
        data: {
          // actorOverride takes priority; falls back to JWT claims when present
          userId:       entry.actorOverride?.userId    ?? request.user?.sub     ?? null,
          tenantId:     entry.actorOverride?.tenantId  ?? request.user?.tenantId ?? null,
          userEmail:    entry.actorOverride?.userEmail ?? request.user?.email    ?? null,
          userRole:     entry.actorOverride?.userRole  ?? request.user?.role     ?? null,
          action:       entry.action,
          resourceType: entry.resourceType,
          resourceId:   entry.resourceId ?? null,
          // Prisma JSON fields accept any — Record<string, unknown> is compatible at runtime
          oldValues:    (entry.oldValues ?? null) as any,
          newValues:    (entry.newValues ?? null) as any,
          ipAddress:    request.ip,
          userAgent:    request.headers["user-agent"] ?? null,
          requestId:    request.id,
        },
      });
    }
  );
};

export const auditPlugin = fp(auditPluginImpl, { name: "audit" });
