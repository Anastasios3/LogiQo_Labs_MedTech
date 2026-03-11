/**
 * Stripe webhook handler — POST /webhooks/stripe
 *
 * No authentication. Stripe signs every event with STRIPE_WEBHOOK_SECRET;
 * we verify the signature before processing anything.
 *
 * Raw-body note:
 *   Stripe signature verification requires the raw (unparsed) request body.
 *   We register a scoped application/json content-type parser that returns
 *   the body as a Buffer. This parser is scoped to this plugin only (it is
 *   NOT wrapped with fastify-plugin) and does not affect any other route.
 *
 * Events handled:
 *   checkout.session.completed        → activate subscription in DB
 *   customer.subscription.updated     → sync subscription status
 *   customer.subscription.deleted     → mark subscription canceled
 *
 * All unrecognised events are acknowledged with 200 and ignored.
 * Processing errors are logged at ERROR level but still return 200 to
 * prevent Stripe from retrying — monitor logs for these events.
 *
 * Cache invalidation:
 *   Every status change deletes `sub_status:{auth0UserId}` from Redis so
 *   the subscription gate sees the new state within the next request.
 */
import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import Stripe from "stripe";
import { stripe } from "../../lib/stripe.js";

// ── Internal dep type (avoids passing the full FastifyInstance everywhere) ────
type Deps = {
  db:    FastifyInstance["db"];
  redis: FastifyInstance["redis"];
  log:   FastifyInstance["log"];
};

// ── Plugin ────────────────────────────────────────────────────────────────────

export const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Override the JSON content-type parser for this scope only.
  // Fastify's default JSON parser returns a parsed object; Stripe's
  // constructEvent() requires the raw Buffer to verify the HMAC signature.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => done(null, body),
  );

  fastify.post("/stripe", async (request, reply) => {
    // ── 1. Verify Stripe signature ─────────────────────────────────────────────
    const sig = request.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      return reply.code(400).send({ error: "Missing stripe-signature header" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      fastify.log.error("STRIPE_WEBHOOK_SECRET is not set — cannot verify Stripe webhook events");
      // Return 500 only when the server is misconfigured; this prevents
      // Stripe from retrying indefinitely against a broken endpoint.
      return reply.code(500).send({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        webhookSecret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signature verification failed";
      fastify.log.warn({ err }, "Stripe webhook signature verification failed");
      return reply.code(400).send({ error: msg });
    }

    fastify.log.info({ type: event.type, id: event.id }, "Stripe webhook received");

    // ── 2. Dispatch ────────────────────────────────────────────────────────────
    // Errors during processing are caught and logged — we always return 200
    // so Stripe does not retry (which would cause duplicate operations).
    const deps: Deps = { db: fastify.db, redis: fastify.redis, log: fastify.log };
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(deps, event.data.object as Stripe.Checkout.Session);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(deps, event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(deps, event.data.object as Stripe.Subscription);
          break;
        default:
          fastify.log.info({ type: event.type }, "Unhandled Stripe event type — no action taken");
      }
    } catch (err) {
      fastify.log.error(
        { err, eventType: event.type, eventId: event.id },
        "Failed to process Stripe event — returning 200 to prevent retry; investigate this error"
      );
    }

    return reply.code(200).send({ received: true });
  });
};

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  { db, redis, log }: Deps,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // client_reference_id is our DB user.id (set at checkout session creation)
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) {
    log.error({ sessionId: session.id }, "checkout.session.completed: missing userId — cannot process");
    return;
  }

  const customerId     = extractId(session.customer);
  const subscriptionId = extractId(session.subscription);

  if (!customerId || !subscriptionId) {
    log.error({ sessionId: session.id }, "checkout.session.completed: missing customer or subscription ID");
    return;
  }

  // tier was set in metadata at checkout creation — avoids an extra Stripe API call
  const tier = session.metadata?.tier ?? null;

  // Update user and get auth0UserId for cache invalidation in one query
  const updated = await db.user.update({
    where:  { id: userId },
    data:   {
      subscriptionStatus:   "active",
      subscriptionTier:     tier,
      stripeCustomerId:     customerId,
      stripeSubscriptionId: subscriptionId,
    },
    select: { auth0UserId: true },
  });

  await invalidateCache(redis, log, updated.auth0UserId);

  // If org plan and organizationName provided, rename the user's current tenant
  const orgName = session.metadata?.organizationName;
  if (tier?.startsWith("org_") && orgName) {
    const user = await db.user.findUnique({
      where:  { id: userId },
      select: { tenantId: true },
    });
    if (user?.tenantId) {
      await db.tenant.update({
        where: { id: user.tenantId },
        data:  { name: orgName, planTier: "organization" },
      });
    }
  }

  // Audit convention: resourceId = stripeSubscriptionId for all subscription
  // lifecycle events so audit log entries are correlatable by subscription.
  // userId = dbUser.id (our internal ID) in all three lifecycle handlers.
  //
  // checkoutSessionId is included in newValues (not only in requestId) so the
  // join to the upstream user.checkout.initiated entry — which uses session.id
  // as its resourceId — is queryable via a jsonb operator on the newValues
  // column. Without it the cs_xxx in the checkout entry has no downstream
  // anchor in a queryable field.
  await writeAuditLog(db, {
    userId,
    action:     "user.subscription.activated",
    resourceId: subscriptionId,
    newValues:  {
      subscriptionStatus:   "active",
      subscriptionTier:     tier,
      stripeCustomerId:     customerId,
      stripeSubscriptionId: subscriptionId,
      checkoutSessionId:    session.id,   // join key → user.checkout.initiated.resourceId
    },
    requestId:  session.id,
  });

  log.info({ userId, subscriptionId, tier }, "Subscription activated");
}

async function handleSubscriptionUpdated(
  { db, redis, log }: Deps,
  subscription: Stripe.Subscription,
): Promise<void> {
  // Prefer metadata.userId (set at checkout); fall back to customerId lookup
  const user = await resolveUserBySubscription(db, log, subscription);
  if (!user) return;

  const status = subscription.status;

  await db.user.update({
    where: { id: user.id },
    data:  { subscriptionStatus: status },
  });

  await invalidateCache(redis, log, user.auth0UserId);

  // ── past_due grace window marker ──────────────────────────────────────────
  // The subscription gate reads `sub_past_due_since:{auth0UserId}` (Unix epoch
  // ms) to enforce the configurable grace window set by
  // SUBSCRIPTION_PAST_DUE_GRACE_DAYS. We stamp it only on the FIRST past_due
  // event to preserve the original failure time across Stripe's repeated
  // retry events. When the status recovers (or the subscription is deleted),
  // the marker is cleared so a future past_due cycle starts a fresh window.
  const pastDueSinceKey = `sub_past_due_since:${user.auth0UserId}`;
  try {
    if (status === "past_due") {
      // SET NX (only if not exists) — ioredis doesn't have a direct SETNX+EX
      // shorthand in one call, so we check first. The tiny race is harmless:
      // worst case the stamp is refreshed by a duplicate past_due event, which
      // only slightly extends the effective window.
      const existing = await redis.get(pastDueSinceKey);
      if (!existing) {
        // TTL is derived from the configured grace window rather than a fixed
        // constant so the key is guaranteed to outlive the window regardless of
        // how SUBSCRIPTION_PAST_DUE_GRACE_DAYS is set.
        //
        // Formula: max(graceDays × 2, 90) days.
        //   × 2    — the key must live well beyond the window end so it is still
        //            present when the gate evaluates the LAST request during the
        //            final day of the grace period.
        //   min 90 — floor prevents a tiny TTL when graceDays is 0 or small;
        //            90 days gives a comfortable ceiling for any realistic window.
        //
        // Stripe fires subscription.deleted (clearing the key explicitly) well
        // before this TTL expires under normal operation.
        const graceDays   = Math.max(0, Number(process.env.SUBSCRIPTION_PAST_DUE_GRACE_DAYS ?? "0"));
        const ttlSeconds  = Math.max(graceDays * 2, 90) * 86_400;
        await redis.set(pastDueSinceKey, Date.now(), "EX", ttlSeconds);
        log.info({ auth0UserId: user.auth0UserId, ttlDays: ttlSeconds / 86_400 }, "[subscription-gate] past_due marker stamped");
      }
    } else {
      // Status improved (active, canceled, incomplete, etc.) — clear the marker
      // so a future past_due cycle starts a fresh grace window.
      await redis.del(pastDueSinceKey);
    }
  } catch (err) {
    log.warn(
      { err, auth0UserId: user.auth0UserId },
      "[subscription-gate] Failed to update past_due marker — grace window enforcement may be inaccurate"
    );
  }

  // Audit convention: resourceId = stripeSubscriptionId for all subscription
  // lifecycle events so audit log entries are correlatable by subscription.
  await writeAuditLog(db, {
    userId:     user.id,
    action:     "user.subscription.updated",
    resourceId: subscription.id,
    newValues:  { subscriptionStatus: status },
    requestId:  subscription.id,
  });

  log.info({ userId: user.id, subscriptionId: subscription.id, status }, "Subscription status synced");
}

async function handleSubscriptionDeleted(
  { db, redis, log }: Deps,
  subscription: Stripe.Subscription,
): Promise<void> {
  const user = await resolveUserBySubscription(db, log, subscription);
  if (!user) return;

  await db.user.update({
    where: { id: user.id },
    data:  { subscriptionStatus: "canceled" },
  });

  await invalidateCache(redis, log, user.auth0UserId);

  // Clear the past_due grace marker — the subscription is definitively ended.
  // Any future re-subscription will start a fresh past_due window if needed.
  try {
    await redis.del(`sub_past_due_since:${user.auth0UserId}`);
  } catch (err) {
    log.warn({ err, auth0UserId: user.auth0UserId }, "[subscription-gate] Failed to clear past_due marker on deletion");
  }

  // Audit convention: resourceId = stripeSubscriptionId for all subscription
  // lifecycle events so audit log entries are correlatable by subscription.
  await writeAuditLog(db, {
    userId:     user.id,
    action:     "user.subscription.canceled",
    resourceId: subscription.id,
    newValues:  { subscriptionStatus: "canceled" },
    requestId:  subscription.id,
  });

  log.info({ userId: user.id, subscriptionId: subscription.id }, "Subscription canceled");
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Resolve a DB user from a subscription event via metadata.userId or customerId lookup. */
async function resolveUserBySubscription(
  db:           Deps["db"],
  log:          Deps["log"],
  subscription: Stripe.Subscription,
): Promise<{ id: string; auth0UserId: string } | null> {
  const metaUserId = subscription.metadata?.userId;
  if (metaUserId) {
    const user = await db.user.findUnique({
      where:  { id: metaUserId },
      select: { id: true, auth0UserId: true },
    });
    if (user) return user;
  }

  // Fall back to Stripe customerId → DB lookup
  const customerId = extractId(subscription.customer);
  if (!customerId) {
    log.warn({ subscriptionId: subscription.id }, "Subscription event has no resolvable user");
    return null;
  }

  const user = await db.user.findFirst({
    where:  { stripeCustomerId: customerId },
    select: { id: true, auth0UserId: true },
  });

  if (!user) {
    log.warn({ customerId, subscriptionId: subscription.id }, "No user found for Stripe customer — event ignored");
  }

  return user ?? null;
}

/** Invalidate the subscription status Redis cache for this user. */
async function invalidateCache(
  redis: Deps["redis"],
  log:   Deps["log"],
  auth0UserId: string,
): Promise<void> {
  try {
    await redis.del(`sub_status:${auth0UserId}`);
  } catch (err) {
    log.warn({ err }, "[subscription-gate] Redis cache invalidation failed — status will update on next TTL expiry");
  }
}

/**
 * Write a webhook-originated audit log entry directly to the DB.
 * We bypass fastify.audit() because there is no FastifyRequest in webhook context.
 */
async function writeAuditLog(
  db: Deps["db"],
  opts: {
    userId:     string;
    action:     string;
    resourceId: string;
    newValues:  Record<string, unknown>;
    requestId:  string;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId:       opts.userId,
      tenantId:     null,
      userEmail:    null,
      userRole:     null,
      action:       opts.action,
      resourceType: "subscription",
      resourceId:   opts.resourceId,
      newValues:    opts.newValues as any,
      ipAddress:    "stripe-webhook",
      userAgent:    "Stripe",
      requestId:    opts.requestId,
    },
  });
}

/** Safely extract an ID string from a Stripe expandable field (string | object | null). */
function extractId(field: string | { id: string } | null | undefined): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}
