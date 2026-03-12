"use client";

/**
 * /subscribe — Subscription management page.
 *
 * Two modes depending on the user's current subscriptionStatus:
 *
 *   A. No active subscription ("none" | "canceled") — shows plan selector grid.
 *      User picks a plan → PlanCards redirects to Stripe Checkout.
 *
 *   B. Has an active subscription ("active" | "trialing" | "past_due") — shows
 *      a minimal portal card with a "Manage subscription" CTA.  Clicking it
 *      calls POST /subscribe/portal → redirects to the Stripe Billing Portal
 *      where the user can update card, cancel, or download invoices.
 *
 * Auth:
 *   Protected by middleware (withMiddlewareAuthRequired on /subscribe).
 *   Reads subscriptionStatus from GET /users/me.
 *
 * Error handling:
 *   API errors (network, 402, etc.) fall back to plan selector so the user
 *   always has a path to subscribe.
 */

import { useEffect, useState } from "react";
import Link                    from "next/link";
import { PlanCards }           from "@/components/subscribe/plan-cards";
import { apiClient }           from "@/lib/api-client";
import type { SubscriptionStatus } from "@logiqo/shared";

// ── Portal card (existing subscriber) ────────────────────────────────────────

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  active:   { text: "Active",   color: "bg-green-100  text-green-800"  },
  trialing: { text: "Trialing", color: "bg-blue-100   text-blue-800"   },
  past_due: { text: "Past due", color: "bg-amber-100  text-amber-800"  },
  canceled: { text: "Canceled", color: "bg-red-100    text-red-700"    },
  none:     { text: "None",     color: "bg-gray-100   text-gray-600"   },
};

function PortalCard({ status }: { status: SubscriptionStatus }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const meta = STATUS_LABEL[status] ?? STATUS_LABEL.none!;

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await apiClient.subscribe.portal();
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open billing portal.";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
      {/* Shield icon */}
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
        <svg
          className="h-7 w-7 text-green-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>

      {/* Status badge */}
      <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold mb-3 ${meta.color}`}>
        {meta.text}
      </span>

      <h2 className="text-xl font-bold text-gray-900 mb-2">Your subscription</h2>

      {status === "past_due" ? (
        <p className="text-sm text-amber-700 mb-6 leading-relaxed">
          Your last payment didn&apos;t go through. Please update your payment method to keep
          your access. Stripe will retry the charge automatically, but you can resolve it now.
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You have an active LogiQo subscription. Use the portal below to update your payment
          method, view invoices, or cancel your plan.
        </p>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        aria-busy={loading}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center gap-2"
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {loading ? "Opening billing portal…" : "Manage subscription"}
      </button>

      <p className="mt-4 text-xs text-gray-400">
        You will be redirected to Stripe&apos;s secure billing portal.
      </p>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function SubscribePage() {
  const [status,   setStatus]   = useState<SubscriptionStatus | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiClient.users.me()
      .then((me) => setStatus(me.subscriptionStatus ?? "none"))
      .catch(() => setStatus("none"))  // fall back to plan selector on error
      .finally(() => setLoading(false));
  }, []);

  const hasActiveSub =
    status === "active" ||
    status === "trialing" ||
    status === "past_due";

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="mx-auto max-w-5xl">

        {/* Back to dashboard */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>
          <p className="mt-2 text-gray-500">
            {hasActiveSub
              ? "Manage your existing subscription or update your billing details."
              : "Choose a plan to access the full LogiQo platform."}
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="mx-auto max-w-md animate-pulse space-y-4">
            <div className="h-12 rounded-xl bg-gray-200" />
            <div className="h-48 rounded-xl bg-gray-200" />
          </div>
        )}

        {/* Portal card for existing subscribers */}
        {!loading && hasActiveSub && status && (
          <PortalCard status={status} />
        )}

        {/* Plan grid for new / canceled subscribers */}
        {!loading && !hasActiveSub && (
          <>
            <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
              <span className="font-semibold">14-day free trial</span> included with every plan.
              No credit card charged until the trial ends.
            </div>
            <PlanCards />
          </>
        )}
      </div>
    </div>
  );
}
