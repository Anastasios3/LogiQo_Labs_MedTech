/**
 * Subscription gate plugin.
 *
 * Decorates the Fastify instance with `checkSubscription`, a preHandler
 * function that enforces an active subscription before allowing access.
 *
 * IMPORTANT — hook ordering:
 *   `checkSubscription` assumes `request.user` is already populated.
 *   Always call `fastify.authenticate(request)` BEFORE calling this in the
 *   same preHandler, or register it in a scope where authenticate runs first.
 *
 * Cache strategy:
 *   Subscription status is cached in Redis for 60 s per user.
 *   Stripe webhook handler is responsible for invalidating the cache key
 *   `sub_status:{auth0UserId}` whenever subscriptionStatus changes.
 *
 * Exemptions (applied in server.ts by registering routes outside the
 *   protected scope — this decorator itself has no URL filter):
 *   /auth/*       — onboarding flow (register, verify-email, submit-npi)
 *   /health       — liveness probe
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

/** Redis TTL for cached subscription status (seconds). */
const SUB_CACHE_TTL = 60;

declare module "fastify" {
  interface FastifyInstance {
    checkSubscription: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const subscriptionGateImpl: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "checkSubscription",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // system_admin accounts bypass the gate so admin tooling is always reachable
      if (request.user.role === "system_admin") return;

      const userId   = request.user.sub;
      const cacheKey = `sub_status:${userId}`;

      // ── 1. Redis cache ─────────────────────────────────────────────────────
      let status: string | null = null;
      try {
        status = await fastify.redis.get(cacheKey);
      } catch (redisErr) {
        // Redis unavailable — fall through to DB. Log but don't crash the request.
        fastify.log.warn(
          { err: redisErr },
          "[subscription-gate] Redis unavailable — falling back to DB for subscription status"
        );
      }

      if (status !== null) {
        if (status !== "active") {
          return reply.code(402).send({
            error:      "Active subscription required",
            redirectTo: "/subscribe",
          });
        }
        return; // cached "active" — allow through
      }

      // ── 2. DB lookup (cache miss or Redis down) ────────────────────────────
      const dbUser = await fastify.db.user.findUnique({
        where:  { auth0UserId: userId },
        select: { subscriptionStatus: true },
      });

      // Distinguish "not subscribed" from "account not provisioned yet".
      // A valid JWT with no matching DB row typically indicates a race between
      // the Auth0 callback and /auth/register's DB insert, or a failed
      // registration that left Auth0 provisioned but our DB empty.
      // Return 401 (not 402) so clients can show a diagnosable error rather
      // than a misleading "subscribe to continue" prompt.
      if (dbUser === null) {
        return reply.code(401).send({
          error: "User account not found. If you just registered, please wait a moment and try again. If the problem persists, contact support.",
          code:  "USER_NOT_PROVISIONED",
        });
      }

      status = dbUser.subscriptionStatus;

      // Write-through: cache for 60 s. Short TTL means Stripe webhooks propagate
      // within one cache window; long enough to protect DB under load.
      try {
        await fastify.redis.setex(cacheKey, SUB_CACHE_TTL, status);
      } catch {
        // Silently skip — Redis being down is already logged above (or wasn't)
      }

      if (status !== "active") {
        return reply.code(402).send({
          error:      "Active subscription required",
          redirectTo: "/subscribe",
        });
      }
    }
  );
};

export const subscriptionGatePlugin = fp(subscriptionGateImpl, {
  name:         "subscription-gate",
  dependencies: ["db", "redis"],
});
