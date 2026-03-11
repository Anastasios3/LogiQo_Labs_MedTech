/**
 * Subscribe routes:
 *
 *   POST /subscribe/checkout  — create a Stripe Checkout session (tier 2+ required)
 *   POST /subscribe/portal    — create a Stripe Customer Portal session (subscription required)
 *
 * Both routes are registered OUTSIDE the protectedRoutes subscription gate because:
 *   - /checkout: user may not have an active subscription yet (that's the point)
 *   - /portal:   subscription check is done inline (stripeCustomerId required)
 *
 * Auth is handled explicitly in each handler via fastify.authenticate().
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { stripe } from "../../lib/stripe.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  priceId: z.string().min(1, "priceId is required"),
  /**
   * Required for org plans (org_monthly / org_annual).
   * Stored in Stripe session metadata and used to name the tenant on payment success.
   */
  organizationName: z.string().min(1).max(200).trim().optional(),
});

// ── Route plugin ──────────────────────────────────────────────────────────────

export const subscribeRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Price-ID lookup tables (initialized once at plugin boot) ─────────────────
  // Building frozen structures at startup gives O(1) Map/Set lookups per request
  // instead of O(n) sequential process.env string comparisons on every call.
  // This also future-proofs the code: adding a new plan only requires one extra
  // env var entry here rather than a new if-branch in a hot request path.
  //
  // The .filter() strips entries whose env vars are not set so that `undefined`
  // is never silently coerced to the string "undefined" and matched against a
  // real price ID.
  const PRICE_TIER_MAP: Readonly<Record<string, string>> = Object.freeze(
    Object.fromEntries(
      ([
        [process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY, "individual_monthly"],
        [process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL,  "individual_annual"],
        [process.env.STRIPE_PRICE_ORG_MONTHLY,        "org_monthly"],
        [process.env.STRIPE_PRICE_ORG_ANNUAL,         "org_annual"],
      ] as [string | undefined, string][])
        .filter((entry): entry is [string, string] => Boolean(entry[0]))
    )
  );

  const ORG_PRICE_IDS = new Set<string>(
    [process.env.STRIPE_PRICE_ORG_MONTHLY, process.env.STRIPE_PRICE_ORG_ANNUAL]
      .filter((id): id is string => Boolean(id))
  );

  // Warn at boot for any unconfigured price IDs — catches misconfiguration
  // early rather than surfacing as silent 400s at runtime under real traffic.
  const REQUIRED_PRICE_ENVS: Record<string, string> = {
    STRIPE_PRICE_INDIVIDUAL_MONTHLY: "individual_monthly",
    STRIPE_PRICE_INDIVIDUAL_ANNUAL:  "individual_annual",
    STRIPE_PRICE_ORG_MONTHLY:        "org_monthly",
    STRIPE_PRICE_ORG_ANNUAL:         "org_annual",
  };
  for (const [envVar, planName] of Object.entries(REQUIRED_PRICE_ENVS)) {
    if (!process.env[envVar]) {
      fastify.log.warn(
        `[subscribe] ${envVar} is not set — "${planName}" plan will be unavailable at runtime`
      );
    }
  }

  // ── POST /subscribe/checkout ─────────────────────────────────────────────────
  // Requires: authenticated + verificationTier >= 2 (NPI verified)
  // Creates a Stripe Checkout session and returns its URL.
  // The frontend redirects the user to checkoutUrl to complete payment.
  fastify.post("/checkout", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {

    // Auth — explicit since this plugin is outside the protected scope
    await fastify.authenticate(request);

    // ── Validate body ───────────────────────────────────────────────────────────
    let body: z.infer<typeof checkoutSchema>;
    try {
      body = checkoutSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Validation failed",
          errors:  err.errors.map(e => ({ field: e.path.join("."), message: e.message })),
        });
      }
      throw err;
    }

    // ── Validate priceId is one of our known prices ────────────────────────────
    const tier = PRICE_TIER_MAP[body.priceId] ?? null;
    if (!tier) {
      return reply.code(400).send({ message: "Invalid priceId. Must be one of the configured plan price IDs." });
    }

    // ── Org plan requires organizationName ────────────────────────────────────
    const isOrg = ORG_PRICE_IDS.has(body.priceId);
    if (isOrg && !body.organizationName) {
      return reply.code(400).send({ message: "organizationName is required for organisation plans." });
    }

    // ── Require NPI verification (tier 2+) ────────────────────────────────────
    if (request.user.verificationTier < 2) {
      return reply.code(403).send({
        message:
          "NPI verification required before subscribing. " +
          "Please complete NPI verification at POST /auth/submit-npi first.",
      });
    }

    // ── Load user from DB ──────────────────────────────────────────────────────
    const dbUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, email: true, stripeCustomerId: true },
    });
    if (!dbUser) return reply.code(404).send({ message: "User not found." });

    // ── Create Stripe Checkout session ─────────────────────────────────────────
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode:       "subscription",
      line_items: [{ price: body.priceId, quantity: 1 }],

      // Reuse existing Stripe customer if the user has subscribed before
      ...(dbUser.stripeCustomerId
        ? { customer: dbUser.stripeCustomerId }
        : { customer_email: dbUser.email }),

      // client_reference_id lets the webhook resolve our DB user without
      // relying on Stripe metadata (which could be spoofed in theory).
      client_reference_id: dbUser.id,

      success_url: `${appUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/subscribe/cancel`,

      metadata: {
        userId: dbUser.id,
        tier,
        ...(body.organizationName ? { organizationName: body.organizationName } : {}),
      },

      // Propagate userId into the subscription's own metadata so
      // customer.subscription.updated events can resolve the user.
      subscription_data: {
        metadata: { userId: dbUser.id, tier },
      },
    });

    // Audit convention: all subscription-lifecycle entries use stripeSubscriptionId
    // as resourceId. This is the deliberate exception — no subscription ID (sub_xxx)
    // exists at checkout-creation time; the subscription is only created by Stripe
    // after the user completes payment. We use the Stripe session ID (cs_xxx) as
    // the closest correlating identifier. The final sub_xxx appears in the
    // user.subscription.activated entry written by the checkout.session.completed
    // webhook handler; the join is queryable via:
    //   checkout.resourceId (cs_xxx) == activated.newValues.checkoutSessionId
    await fastify.audit(request, {
      action:       "user.checkout.initiated",
      resourceType: "subscription",
      resourceId:   session.id,
      newValues:    { priceId: body.priceId, tier, sessionId: session.id },
    });

    return reply.code(200).send({ checkoutUrl: session.url });
  });

  // ── POST /subscribe/portal ───────────────────────────────────────────────────
  // Requires: authenticated + existing Stripe customer (i.e. at least one past payment)
  // Creates a Stripe Customer Portal session and returns its URL.
  // The user can update payment method, view invoices, or cancel from the portal.
  fastify.post("/portal", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {

    await fastify.authenticate(request);

    const dbUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, stripeCustomerId: true, subscriptionStatus: true },
    });
    if (!dbUser) return reply.code(404).send({ message: "User not found." });

    // Require a Stripe customer record — no subscription means no portal access
    if (!dbUser.stripeCustomerId) {
      return reply.code(402).send({
        message:    "No subscription found. Please subscribe first.",
        redirectTo: "/subscribe",
      });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   dbUser.stripeCustomerId,
      return_url: `${appUrl}/dashboard`,
      ...(process.env.STRIPE_PORTAL_CONFIG_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID }
        : {}),
    });

    return reply.code(200).send({ portalUrl: portalSession.url });
  });
};
