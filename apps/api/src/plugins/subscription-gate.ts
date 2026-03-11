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
 * past_due grace window:
 *   SUBSCRIPTION_PAST_DUE_GRACE_DAYS (integer, default: 0 = zero-tolerance)
 *   controls how long a past_due subscriber retains access while Stripe
 *   retries the failed charge.
 *
 *   Stripe's default smart-retry schedule spans up to 4 days; setting the
 *   grace window to 3–4 prevents locking out a user whose card declined once
 *   on what is often a recoverable transient error (e.g. temporary hold,
 *   low-balance debit, 3DS auth timeout). Immediate lockout on the first
 *   failure generates unnecessary support load and increases churn.
 *
 *   Zero-tolerance (the default) is the conservative choice for compliance-
 *   heavy deployments where access must be strictly tied to payment status.
 *   Document whichever policy is chosen so the decision is auditable.
 *
 *   The Stripe webhook handler writes `sub_past_due_since:{auth0UserId}`
 *   (Unix epoch ms) to Redis on the FIRST past_due event and clears it when
 *   the subscription recovers or is deleted. The gate reads this timestamp
 *   to enforce the window. If the key is absent (Redis flushed, very first
 *   past_due event not yet received), access is granted as benefit of the
 *   doubt — a missing stamp cannot be distinguished from a recent transition.
 *
 * Exemptions (applied in server.ts by registering routes outside the
 *   protected scope — this decorator itself has no URL filter):
 *   /auth/*       — onboarding flow (register, verify-email, submit-npi)
 *   /health       — liveness probe
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

/** Redis TTL for cached subscription status (seconds). */
const SUB_CACHE_TTL = 60;

declare module "fastify" {
  interface FastifyInstance {
    checkSubscription: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// ── Grace window helper ───────────────────────────────────────────────────────

/**
 * Returns true if the subscription status permits access.
 *
 * - "active"    → always allowed.
 * - "past_due"  → allowed only when graceDays > 0 AND within the grace window.
 *                 The grace window start is read from Redis (`sub_past_due_since:*`).
 *                 If the Redis key is absent, access is granted (benefit of the
 *                 doubt) — a missing key is indistinguishable from a brand-new
 *                 transition that hasn't been stamped yet.
 * - anything else → denied (402).
 */
async function isAccessGranted(
  status:      string,
  auth0UserId: string,
  graceDays:   number,
  redis:       FastifyInstance["redis"],
  log:         FastifyInstance["log"],
): Promise<boolean> {
  if (status === "active") return true;

  if (status === "past_due" && graceDays > 0) {
    const markerKey = `sub_past_due_since:${auth0UserId}`;
    let since: string | null = null;

    try {
      since = await redis.get(markerKey);
    } catch (err) {
      // Redis unavailable — can't enforce the window; fail open so a Redis
      // outage doesn't lock paying subscribers out of the platform.
      log.warn(
        { err, auth0UserId },
        "[subscription-gate] Redis error reading past_due marker — granting benefit of the doubt"
      );
      return true;
    }

    if (!since) {
      // No marker: Redis was flushed or the webhook hasn't arrived yet.
      // Grant access — the webhook will stamp the key on the next event.
      log.warn(
        { auth0UserId },
        "[subscription-gate] past_due marker absent — granting benefit of the doubt (within grace window assumed)"
      );
      return true;
    }

    const elapsedDays = (Date.now() - Number(since)) / 86_400_000;
    const within      = elapsedDays < graceDays;

    log.warn(
      { auth0UserId, elapsedDays: elapsedDays.toFixed(2), graceDays, within },
      within
        ? "[subscription-gate] past_due within grace window — allowing access"
        : "[subscription-gate] past_due grace window expired — blocking access"
    );

    return within;
  }

  // canceled, unpaid, incomplete, trialing-expired, etc. → denied
  return false;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const subscriptionGateImpl: FastifyPluginAsync = async (fastify) => {
  // Parse once at plugin boot — avoids parsing an env string on every request.
  // Math.max(0, ...) clamps negative values to zero-tolerance.
  const graceDays = Math.max(0, Number(process.env.SUBSCRIPTION_PAST_DUE_GRACE_DAYS ?? "0"));

  if (graceDays > 0) {
    fastify.log.info(
      { graceDays },
      "[subscription-gate] past_due grace window enabled"
    );
  } else {
    fastify.log.info(
      "[subscription-gate] past_due grace window disabled (zero-tolerance — any non-active status blocks access)"
    );
  }

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
        const allowed = await isAccessGranted(status, userId, graceDays, fastify.redis, fastify.log);
        if (!allowed) {
          return reply.code(402).send({
            error:      "Active subscription required",
            redirectTo: "/subscribe",
          });
        }
        return; // cached status is within allowed states — let the request through
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

      const allowed = await isAccessGranted(status, userId, graceDays, fastify.redis, fastify.log);
      if (!allowed) {
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
