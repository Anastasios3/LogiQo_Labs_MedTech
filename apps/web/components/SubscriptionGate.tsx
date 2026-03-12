"use client";

/**
 * SubscriptionGate — access control overlay for the dashboard.
 *
 * Behaviour:
 *   1. On mount, calls GET /users/me to fetch the user's subscriptionStatus.
 *   2. While loading → renders children behind a subtle skeleton bar (non-blocking).
 *   3. If subscriptionStatus is "active" or "trialing" → renders children as-is.
 *   4. If subscriptionStatus is absent, "none", "past_due", or "canceled" →
 *      renders a full-page overlay with an explanatory message and a CTA to
 *      /subscribe, while still rendering (but obscuring) the children behind it
 *      so layout remains stable and the overlay size is consistent.
 *   5. On API error (network, 401, etc.) → renders children (fail-open).
 *      Rationale: a transient API failure should not lock out a paid user.
 *      The backend still enforces SUBSCRIPTION_REQUIRED (402) on every route
 *      so a bad actor cannot bypass the gate by blocking the /users/me request.
 *
 * Bypass:
 *   Users with the "system_admin" role (set in the `https://logiqo.io/role`
 *   Auth0 claim) bypass the gate entirely — admins always have access regardless
 *   of tenant subscription state.
 *
 * ── Auth0 Action operational assumption ──────────────────────────────────────
 *   The bypass reads the custom claim `https://logiqo.io/role` from the Auth0
 *   ID token as decoded by `useUser()`. That claim is injected by an Auth0 Post-
 *   Login Action. Two degradation scenarios to be aware of:
 *
 *   A. Action not yet deployed (pre-prod / initial setup):
 *      The claim is absent from the ID token. `role` is undefined, the bypass is
 *      skipped, and the gate falls through to `GET /users/me`. The DB returns the
 *      correct role ("system_admin"), so `subscriptionStatus` from the same call
 *      governs access. The admin is NOT locked out — they just incur one extra
 *      round-trip instead of bypassing. Acceptable degradation.
 *
 *   B. Action runtime failure at login time:
 *      Auth0 can be configured to either block login (safe) or continue without
 *      the Action (draft/non-blocking). In the non-blocking case, the ID token is
 *      issued without the custom claim — same degradation path as scenario A.
 *      Recommendation: set the Action to "block on error" in production so that a
 *      failed Action surfaces as a login error rather than silently missing claims.
 *
 *   REQUIREMENT: The Auth0 Post-Login Action must be deployed and set to
 *   "block on error" before any system_admin account is created in production.
 *   Document this in the ops runbook / Auth0 tenant checklist.
 *
 * Usage (in dashboard/layout.tsx):
 *   import { SubscriptionGate } from "@/components/SubscriptionGate";
 *   …
 *   <SubscriptionGate>{children}</SubscriptionGate>
 */

import { useEffect, useState } from "react";
import Link                    from "next/link";
import { useUser }             from "@auth0/nextjs-auth0/client";
import { apiClient }           from "@/lib/api-client";
import type { SubscriptionStatus } from "@logiqo/shared";

// ── Types ─────────────────────────────────────────────────────────────────────

type GateStatus =
  | "loading"   // Fetching /users/me
  | "allowed"   // Subscription active / trialing / system_admin bypass
  | "blocked"   // Subscription none / past_due / canceled
  | "error";    // API unreachable — fail-open

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

// ── Overlay ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  "none" | "past_due" | "canceled",
  { headline: string; body: string; badge: string; badgeColor: string }
> = {
  none: {
    headline:   "Subscription required",
    body:       "Your account does not have an active subscription. Choose a plan to unlock full access to the LogiQo platform.",
    badge:      "No subscription",
    badgeColor: "bg-gray-100 text-gray-700",
  },
  past_due: {
    headline:   "Payment past due",
    body:       "Your last payment did not go through. Please update your billing details to restore access.",
    badge:      "Payment past due",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  canceled: {
    headline:   "Subscription canceled",
    body:       "Your subscription has been canceled. Renew to continue using LogiQo.",
    badge:      "Subscription canceled",
    badgeColor: "bg-red-100 text-red-700",
  },
};

interface OverlayProps {
  status: "none" | "past_due" | "canceled";
}

function GateOverlay({ status }: OverlayProps) {
  const meta = STATUS_META[status];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-headline"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5 p-8 text-center">

        {/* Lock icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <svg
            className="h-7 w-7 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        {/* Status badge */}
        <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold mb-3 ${meta.badgeColor}`}>
          {meta.badge}
        </span>

        <h2 id="gate-headline" className="text-xl font-bold text-gray-900 mb-2">
          {meta.headline}
        </h2>
        <p className="text-sm text-gray-500 mb-7 leading-relaxed">
          {meta.body}
        </p>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link
            href="/subscribe"
            className="block w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            {status === "past_due" ? "Update billing" : "Subscribe now"}
          </Link>
          {status === "past_due" && (
            <Link
              href="/subscribe"
              className="block w-full rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Manage subscription
            </Link>
          )}
          <a
            href="/api/auth/logout"
            className="text-xs text-gray-400 hover:text-gray-600 mt-1"
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user: auth0User } = useUser();
  const [gateStatus,    setGateStatus]    = useState<GateStatus>("loading");
  const [subStatus,     setSubStatus]     = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    // system_admin role bypasses the subscription check entirely
    const role = (auth0User as Record<string, unknown> | undefined)?.[
      "https://logiqo.io/role"
    ] as string | undefined;
    if (role === "system_admin") {
      setGateStatus("allowed");
      return;
    }

    let cancelled = false;

    apiClient.users.me().then((me) => {
      if (cancelled) return;
      const status = me.subscriptionStatus ?? "none";
      setSubStatus(status);

      if ((ACTIVE_STATUSES as string[]).includes(status)) {
        setGateStatus("allowed");
      } else {
        setGateStatus("blocked");
      }
    }).catch(() => {
      if (!cancelled) {
        // Fail-open: network error / unprovisioned user — don't lock them out
        setGateStatus("error");
      }
    });

    return () => { cancelled = true; };
  }, [auth0User]);

  // Always render children — the overlay sits on top of them via fixed positioning.
  // This prevents layout shifts and keeps SSR-rendered content visible under the blur.
  return (
    <>
      {children}

      {gateStatus === "blocked" && subStatus && subStatus !== "active" && subStatus !== "trialing" && (
        <GateOverlay status={subStatus as "none" | "past_due" | "canceled"} />
      )}
    </>
  );
}
