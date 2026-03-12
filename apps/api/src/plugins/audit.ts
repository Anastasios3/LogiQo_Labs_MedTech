import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

// ── Fields redacted from request body before writing to audit_logs ───────────
// Prevents credentials and sensitive PII from appearing in the audit trail.
const REDACTED_FIELDS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "npiNumber",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "apiKey",
  "token",
  "secret",
  "authorization",
]);

// ── Routes excluded from the automatic onResponse hook ───────────────────────
// /health — high-frequency liveness probe with no user context
// /webhooks — HMAC-signed Stripe callbacks, not associated with a user session
const EXCLUDED_ROUTE_PREFIXES = ["/health", "/webhooks"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a sanitized copy of the request body with sensitive fields replaced
 * by the string "[REDACTED]". Returns null for non-object bodies (GET, etc.).
 */
function sanitizeBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    out[k] = REDACTED_FIELDS.has(k) ? "[REDACTED]" : v;
  }
  return out;
}

/**
 * Explicit route-segment → resourceType map.
 *
 * Why explicit instead of a regex?
 *   `.replace(/s$/, "")` strips any trailing "s", turning "/admin/stats"
 *   into "statu" and a future "/processes" route into "proces". A lookup
 *   map is O(1), predictable, and safe to review in code review.
 *
 * When adding a new route module, add its first path segment here.
 * Unknown segments fall back to the raw segment string so logs remain
 * readable even before the map is updated.
 */
const RESOURCE_TYPE_MAP: Record<string, string> = {
  // Top-level route modules
  "devices":       "device",
  "documents":     "document",
  "alerts":        "alert",
  "annotations":   "annotation",
  "ingestion":     "ingestion_run",
  "settings":      "settings",
  "users":         "user",
  "auth":          "auth",
  "organizations": "organization",
  "subscribe":     "subscription",
  // /admin sub-route segments (resolved after stripping the "admin" prefix)
  "stats":         "stats",
  "audit-logs":    "audit_log",
  "admin":         "admin",      // /admin with no sub-segment
};

/**
 * Derive a stable resourceType string from a Fastify route pattern.
 *
 *   "/devices/:id/approve"   → "device"
 *   "/admin/audit-logs"      → "audit_log"
 *   "/alerts"                → "alert"
 *   "/admin/stats"           → "stats"    (was broken as "statu" with regex)
 *   "/annotations/:id/flags" → "annotation"
 */
function resourceTypeFromPath(routeUrl: string): string {
  const segments = routeUrl.split("/").filter(Boolean);
  const first    = segments[0] ?? "unknown";

  // /admin routes: resolve using the second path segment when present
  const key = first === "admin" && segments[1] ? segments[1] : first;

  return RESOURCE_TYPE_MAP[key] ?? key; // safe fallback: raw segment, no mutation
}

// ── AuditEntry type (used by manual fastify.audit() calls) ───────────────────

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

// ── Plugin ────────────────────────────────────────────────────────────────────

const auditPluginImpl: FastifyPluginAsync = async (fastify) => {

  // ── Manual decorator — fastify.audit(request, entry) ─────────────────────
  //
  // Used by route handlers for semantic, business-level audit events with
  // enriched context: old/new values, specific resourceId, actor overrides
  // for unauthenticated flows (e.g. registration before a JWT is issued).
  //
  // The app_user DB role has INSERT + SELECT ONLY on audit_logs.
  // UPDATE and DELETE are revoked — enforced at DB level (migration 005).
  //
  fastify.decorate(
    "audit",
    async (request: FastifyRequest, entry: AuditEntry) => {
      await fastify.db.auditLog.create({
        data: {
          // actorOverride takes priority; falls back to JWT claims
          userId:       entry.actorOverride?.userId    ?? request.user?.sub     ?? null,
          tenantId:     entry.actorOverride?.tenantId  ?? request.user?.tenantId ?? null,
          userEmail:    entry.actorOverride?.userEmail ?? request.user?.email    ?? null,
          userRole:     entry.actorOverride?.userRole  ?? request.user?.role     ?? null,
          action:       entry.action,
          resourceType: entry.resourceType,
          resourceId:   entry.resourceId ?? null,
          oldValues:    (entry.oldValues ?? null) as any,
          newValues:    (entry.newValues ?? null) as any,
          ipAddress:    request.ip,
          userAgent:    request.headers["user-agent"] ?? null,
          requestId:    request.id,
        },
      });
    }
  );

  // ── Automatic onResponse hook — HTTP-level audit for every request ────────
  //
  // Fires after the response has been sent to the client (cannot block it).
  // Writes one row per request:
  //
  //   action         "{METHOD} {route pattern}"   e.g. "POST /alerts/:id/acknowledge"
  //   resourceType   derived from first route segment (see resourceTypeFromPath)
  //   resourceId     request.params.id when present
  //   responseStatus HTTP status code (200, 201, 400, …)
  //   requestBody    sanitized body — REDACTED_FIELDS replaced with "[REDACTED]"
  //   userId         Auth0 sub from JWT (null for unauthenticated routes)
  //
  // Relationship to manual fastify.audit() calls:
  //   Some requests produce TWO audit entries — one from this hook (HTTP-level,
  //   proves the request happened) and one from the manual call (business-level,
  //   captures semantic context like old/new values). Both are valuable for HIPAA.
  //
  // Error handling:
  //   A failed audit write NEVER surfaces to the client (response already sent).
  //   Failures are logged at ERROR level for alerting and investigation.
  //
  fastify.addHook("onResponse", async (request, reply) => {
    // routeOptions.url is the registered pattern ("/devices/:id"),
    // not the actual URL ("/devices/abc-123") — used for action labelling.
    const routeUrl = request.routeOptions?.url ?? request.url;

    // Skip high-volume / context-free routes
    for (const prefix of EXCLUDED_ROUTE_PREFIXES) {
      if (routeUrl === prefix || routeUrl.startsWith(`${prefix}/`)) return;
    }

    try {
      const user   = request.user; // undefined for unauthenticated routes
      const params = request.params as Record<string, string> | undefined;

      // Best-effort resourceId: pick the first recognisable param
      const resourceId =
        params?.id           ??
        params?.alertId      ??
        params?.annotationId ??
        null;

      await fastify.db.auditLog.create({
        data: {
          userId:         user?.sub      ?? null,
          tenantId:       user?.tenantId ?? null,
          userEmail:      user?.email    ?? null,
          userRole:       user?.role     ?? null,
          action:         `${request.method} ${routeUrl}`,
          resourceType:   resourceTypeFromPath(routeUrl),
          resourceId,
          requestBody:    sanitizeBody(request.body) as any,
          responseStatus: reply.statusCode,
          ipAddress:      request.ip,
          userAgent:      request.headers["user-agent"] ?? null,
          requestId:      request.id,
        },
      });
    } catch (err) {
      // Never let an audit failure affect client-visible behaviour.
      fastify.log.error(
        { err, url: request.url, method: request.method },
        "[audit] onResponse hook failed — entry not written"
      );
    }
  });
};

export const auditPlugin = fp(auditPluginImpl, { name: "audit" });
