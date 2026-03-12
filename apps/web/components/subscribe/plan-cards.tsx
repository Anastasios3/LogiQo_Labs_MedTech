"use client";

/**
 * PlanCards — reusable subscription plan selector.
 *
 * Rendered in two contexts:
 *   1. /onboarding (step 3) — first-time plan selection after NPI submission
 *   2. /subscribe            — returning user re-selecting or upgrading a plan
 *
 * The component handles the Stripe redirect itself via `apiClient.subscribe.checkout()`.
 * A loading state is shown per-card so the user sees immediate feedback.
 */

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { PlanId } from "@/stores/onboarding";

// ── Plan catalogue ────────────────────────────────────────────────────────────

interface Plan {
  id:          PlanId;
  name:        string;
  audience:    string;
  price:       string;
  period:      string;
  /** Annual saving message shown on annual plans. */
  saving?:     string;
  features:    string[];
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    id:       "individual_monthly",
    name:     "Individual",
    audience: "Clinicians & solo practitioners",
    price:    "$49",
    period:   "/month",
    features: [
      "Full Hardware Index access",
      "Peer Annotation submission",
      "Alert acknowledgement",
      "500 API requests / day",
      "Export up to 1,000 audit rows",
    ],
    highlighted: false,
  },
  {
    id:       "individual_annual",
    name:     "Individual Annual",
    audience: "Best for full-year clinical work",
    price:    "$470",
    period:   "/year",
    saving:   "Save $118 vs monthly",
    features: [
      "Everything in Individual",
      "Priority support",
      "Early access to new features",
      "2,000 API requests / day",
    ],
    highlighted: true,
  },
  {
    id:       "org_monthly",
    name:     "Organisation",
    audience: "Hospital teams & safety officers",
    price:    "$199",
    period:   "/month",
    features: [
      "Up to 25 seats",
      "Shared alert inbox",
      "SOP document management",
      "SSO / SAML integration",
      "Unlimited API requests",
      "Full audit log export",
    ],
    highlighted: false,
  },
  {
    id:       "org_annual",
    name:     "Organisation Annual",
    audience: "Enterprise hospitals, BAA included",
    price:    "$1,990",
    period:   "/year",
    saving:   "Save $398 vs monthly",
    features: [
      "Everything in Organisation",
      "HIPAA BAA signing",
      "Dedicated account manager",
      "Custom seat limits",
      "SLA: 99.9 % uptime",
    ],
    highlighted: false,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface PlanCardsProps {
  /** Pre-selected plan (highlights that card). */
  selectedPlan?: PlanId | null;
  /** Called right before the Stripe redirect — lets parent stores update state. */
  onBeforeRedirect?: (plan: PlanId) => void;
}

export function PlanCards({ selectedPlan, onBeforeRedirect }: PlanCardsProps) {
  // Track which card is mid-redirect to show an inline spinner
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(planId: PlanId) {
    if (loadingPlan) return; // prevent double-clicks during redirect
    setError(null);
    setLoadingPlan(planId);

    try {
      onBeforeRedirect?.(planId);
      const { url } = await apiClient.subscribe.checkout(planId);
      // Hard-navigate to Stripe Checkout (full-page redirect)
      window.location.href = url;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start checkout. Please try again.";
      setError(msg);
      setLoadingPlan(null);
    }
  }

  return (
    <div className="w-full">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="font-semibold">Checkout error: </span>
          {error}
        </div>
      )}

      {/* Plan grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isLoading  = loadingPlan  === plan.id;

          return (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-xl border p-5 transition-shadow",
                plan.highlighted
                  ? "border-blue-500 shadow-md shadow-blue-100 bg-blue-50"
                  : "border-gray-200 bg-white hover:shadow-sm",
                isSelected ? "ring-2 ring-blue-600 ring-offset-1" : "",
              ].join(" ")}
            >
              {/* Popular badge */}
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  Most popular
                </span>
              )}

              {/* Plan name + audience */}
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{plan.audience}</p>
              </div>

              {/* Pricing */}
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.period}</span>
              </div>
              {plan.saving && (
                <p className="mb-4 text-xs font-medium text-green-600">{plan.saving}</p>
              )}
              {!plan.saving && <div className="mb-4" />}

              {/* Features */}
              <ul className="mb-5 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    {/* Checkmark */}
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                type="button"
                onClick={() => handleSelect(plan.id)}
                disabled={!!loadingPlan}
                aria-busy={isLoading}
                className={[
                  "w-full rounded-lg py-2.5 text-sm font-semibold transition-colors",
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100",
                ].join(" ")}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Redirecting…
                  </span>
                ) : isSelected ? (
                  "Current plan"
                ) : (
                  "Select plan"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
