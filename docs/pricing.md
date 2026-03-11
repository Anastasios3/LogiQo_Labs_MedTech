# LogiQo Pricing — Stripe Setup Guide

This document explains how to configure Stripe products, prices, and webhooks for the
LogiQo MedTech platform. All billing is handled by Stripe; the platform never stores raw
card data.

---

## Plans

| Plan | Billing | Stripe price env var |
|---|---|---|
| Individual Monthly | $49 / month | `STRIPE_PRICE_INDIVIDUAL_MONTHLY` |
| Individual Annual | $470 / year (~$39/mo) | `STRIPE_PRICE_INDIVIDUAL_ANNUAL` |
| Organization Monthly | $299 / month | `STRIPE_PRICE_ORG_MONTHLY` |
| Organization Annual | $2,870 / year (~$239/mo) | `STRIPE_PRICE_ORG_ANNUAL` |

> Prices above are illustrative — adjust in the Stripe Dashboard before going live.

---

## Step 1 — Create Products in Stripe Dashboard

1. Log into [https://dashboard.stripe.com](https://dashboard.stripe.com) (use **Test mode** for dev).
2. Go to **Product catalog** → **Add product**.
3. Create two products:
   - **LogiQo Individual** — for solo clinicians
   - **LogiQo Organization** — for hospital teams
4. For each product add the corresponding recurring prices (monthly + annual).
5. Copy each **Price ID** (format: `price_xxx`) into `.env`:

```env
STRIPE_PRICE_INDIVIDUAL_MONTHLY="price_xxx"
STRIPE_PRICE_INDIVIDUAL_ANNUAL="price_xxx"
STRIPE_PRICE_ORG_MONTHLY="price_xxx"
STRIPE_PRICE_ORG_ANNUAL="price_xxx"
```

---

## Step 2 — Configure the Customer Portal

The **Customer Portal** lets subscribers manage their payment method, view invoices, and
cancel at any time (required for HIPAA-eligible SaaS plans).

1. Go to **Settings → Billing → Customer portal**.
2. Enable: cancel subscriptions, update payment method, update billing address.
3. Copy the **Configuration ID** (format: `bpc_xxx`) and set:

```env
STRIPE_PORTAL_CONFIG_ID="bpc_xxx"
```

Leave blank to use Stripe's default portal config (acceptable for dev/staging).

---

## Step 3 — Set up Webhooks

### Local development (Stripe CLI)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe login
stripe listen --forward-to http://localhost:8080/webhooks/stripe
```

The CLI prints a webhook signing secret (format: `whsec_xxx`) — copy it into:

```env
STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

The server must be running on port 8080 before you start the listener.

### Production / staging

1. Go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://api.logiqo.io/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. After saving, reveal the **Signing secret** and add it to the environment:
   ```env
   STRIPE_WEBHOOK_SECRET="whsec_xxx"
   ```

> **Security:** The API verifies every incoming event's HMAC signature using
> `STRIPE_WEBHOOK_SECRET` before processing. Events without a valid signature are
> rejected with HTTP 400. Never expose `STRIPE_WEBHOOK_SECRET` in client-side code.

---

## Step 4 — Set API Keys

From **Developers → API keys**:

```env
STRIPE_PUBLISHABLE_KEY="pk_test_xxx"   # exposed to frontend (safe)
STRIPE_SECRET_KEY="sk_test_xxx"        # server-side only — never expose
```

Use **test** keys for development and staging; switch to **live** keys only on production.

---

## Subscription Flow (end-to-end)

```
User (NPI-verified, tier ≥ 2)
  → POST /subscribe/checkout { priceId }
  → API creates Stripe Checkout session
  → Returns { checkoutUrl }

Frontend redirects user → Stripe Checkout page
  → User enters card details (handled entirely by Stripe)
  → Payment succeeds → Stripe redirects to /subscribe/success?session_id=...

Stripe fires webhook → POST /webhooks/stripe
  → API verifies signature
  → checkout.session.completed → DB: subscriptionStatus = "active"
  → Redis cache invalidated → subscription gate allows access within 1 request

User lands on /dashboard with active subscription
```

For cancellations or plan changes:

```
User → POST /subscribe/portal
  → API creates Stripe Customer Portal session
  → Returns { portalUrl }

Frontend redirects user → Stripe Customer Portal
  → User cancels / changes plan
  → Stripe fires customer.subscription.updated or customer.subscription.deleted
  → Webhook handler syncs status to DB + invalidates Redis cache
```

---

## DB Fields (Prisma User model)

| Field | Updated by | Values |
|---|---|---|
| `subscriptionStatus` | Webhook | `none` \| `active` \| `past_due` \| `canceled` |
| `subscriptionTier` | Webhook (checkout) | `individual_monthly` \| `individual_annual` \| `org_monthly` \| `org_annual` \| `null` |
| `stripeCustomerId` | Webhook (checkout) | `cus_xxx` |
| `stripeSubscriptionId` | Webhook (checkout) | `sub_xxx` |

---

## Testing with Stripe CLI

Use Stripe's test card numbers to simulate payments locally:

| Scenario | Card number |
|---|---|
| Successful payment | `4242 4242 4242 4242` |
| Payment requires auth | `4000 0025 0000 3155` |
| Card declined | `4000 0000 0000 0002` |

Any future expiry and any 3-digit CVC will work.

Trigger specific webhook events manually:

```bash
# Simulate a successful checkout completion
stripe trigger checkout.session.completed

# Simulate subscription cancellation
stripe trigger customer.subscription.deleted
```
