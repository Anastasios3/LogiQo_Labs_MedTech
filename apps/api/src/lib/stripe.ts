/**
 * Stripe client singleton.
 *
 * Import `stripe` wherever you need to call the Stripe API.
 * Never construct a new Stripe instance outside this module.
 *
 * API version is pinned to the version bundled with the installed SDK
 * (stripe@20.x → 2026-02-25.clover) so type-safety is guaranteed.
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Missing in dev before keys are configured — warn but don't crash at import time.
  // Calls will fail at runtime with a clear Stripe error.
  console.warn(
    "[stripe] STRIPE_SECRET_KEY is not set. Stripe API calls will fail. " +
    "Add the key to apps/api/.env (see docs/pricing.md)."
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-02-25.clover",
});
