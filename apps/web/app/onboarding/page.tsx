"use client";

/**
 * /onboarding — 3-step new-user wizard.
 *
 * Step 1 — Email Verification
 *   Reads `user.email_verified` from the Auth0 session via useUser().
 *   If already verified, auto-advances to step 2.
 *   Shows a "Resend verification email" link if not verified.
 *
 * Step 2 — NPI Submission
 *   10-digit NPI input + client-side format validation.
 *   On submit: calls PATCH /users/me/verification (apiClient.users.submitNpi).
 *   On success: advances to step 3 via Zustand setNpiSubmitted().
 *
 * Step 3 — Subscription Plan
 *   Renders shared <PlanCards /> component.
 *   On plan select: PlanCards calls POST /subscribe/checkout and redirects to Stripe.
 *
 * Auth:
 *   Protected by middleware (withMiddlewareAuthRequired on /onboarding).
 *   Uses useUser() for email_verified; falls back to a loading skeleton.
 *
 * Zustand:
 *   useOnboardingStore drives the active step; progress bar derives from it.
 */

import { useEffect, useState } from "react";
import { useUser }             from "@auth0/nextjs-auth0/client";
import { PlanCards }           from "@/components/subscribe/plan-cards";
import { useOnboardingStore }  from "@/stores/onboarding";
import { apiClient }           from "@/lib/api-client";
import type { PlanId }         from "@/stores/onboarding";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEPS: { label: string; title: string; description: string }[] = [
  {
    label:       "Email",
    title:       "Verify your email address",
    description: "We need to confirm your email before you can access clinical features.",
  },
  {
    label:       "NPI",
    title:       "Enter your NPI number",
    description: "Your 10-digit National Provider Identifier lets us confirm your clinical credentials.",
  },
  {
    label:       "Plan",
    title:       "Choose your plan",
    description: "Select the plan that best fits your practice. You can upgrade at any time.",
  },
];

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Onboarding progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const done    = stepNum < current;
          const active  = stepNum === current;

          return (
            <li key={s.label} className="flex flex-1 items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                    done   ? "border-blue-600 bg-blue-600 text-white" :
                    active ? "border-blue-600 bg-white text-blue-600" :
                             "border-gray-300 bg-white text-gray-400",
                  ].join(" ")}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  ) : stepNum}
                </div>
                <span
                  className={[
                    "mt-1 text-xs font-medium",
                    active ? "text-blue-600" : done ? "text-gray-600" : "text-gray-400",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </div>

              {/* Connector line (not after the last step) */}
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    "mx-2 mb-5 h-0.5 flex-1 transition-colors",
                    done ? "bg-blue-600" : "bg-gray-200",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Step 1: Email Verification ────────────────────────────────────────────────

function StepEmailVerification({ onVerified }: { onVerified: () => void }) {
  const { user, isLoading } = useUser();
  const [resent, setResent]  = useState(false);

  // If already verified, skip this step automatically
  useEffect(() => {
    if (!isLoading && user?.email_verified) {
      onVerified();
    }
  }, [isLoading, user?.email_verified, onVerified]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-2/3 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-200" />
        <div className="mt-4 h-10 w-40 rounded bg-gray-200" />
      </div>
    );
  }

  if (user?.email_verified) {
    return (
      <div className="flex items-center gap-3 text-green-600">
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <span className="font-medium">Email verified — advancing to NPI submission…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          A verification link has been sent to{" "}
          <strong>{user?.email ?? "your email address"}</strong>.
        </p>
        <p className="mt-1 text-sm text-amber-700">
          Please click the link in that email to verify your address, then refresh this page.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          I&apos;ve verified — continue
        </button>

        {!resent ? (
          <button
            type="button"
            onClick={async () => {
              // Auth0 /api/auth/login with prompt=login re-triggers the email
              window.location.href = "/api/auth/login?screen_hint=signup";
              setResent(true);
            }}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Resend verification email
          </button>
        ) : (
          <span className="py-2.5 text-sm text-green-600 font-medium">Email resent ✓</span>
        )}
      </div>
    </div>
  );
}

// ── Step 2: NPI Submission ────────────────────────────────────────────────────

const NPI_REGEX = /^\d{10}$/;

function StepNpi({ onSubmitted }: { onSubmitted: () => void }) {
  const [npi, setNpi]         = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]     = useState<string | null>(null);

  const isValid = NPI_REGEX.test(npi);
  const showError = touched && !isValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;

    setSubmitting(true);
    setApiError(null);

    try {
      await apiClient.users.submitNpi(npi);
      onSubmitted();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to validate NPI. Please try again.";
      setApiError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-sm">
      <div>
        <label htmlFor="npi-input" className="block text-sm font-medium text-gray-700 mb-1">
          NPI Number
        </label>
        <input
          id="npi-input"
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          onChange={(e) => {
            // Allow only digits
            setNpi(e.target.value.replace(/\D/g, "").slice(0, 10));
            setApiError(null);
          }}
          onBlur={() => setTouched(true)}
          placeholder="10-digit NPI"
          aria-describedby={showError ? "npi-error" : undefined}
          aria-invalid={showError}
          className={[
            "w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm outline-none transition-colors",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            showError
              ? "border-red-400 bg-red-50 text-red-900"
              : "border-gray-300 bg-white text-gray-900",
          ].join(" ")}
        />
        {showError && (
          <p id="npi-error" role="alert" className="mt-1.5 text-xs text-red-600">
            NPI must be exactly 10 digits.
          </p>
        )}
        {apiError && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {apiError}
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Your NPI is cross-checked against the NPPES public registry and stored against your
        account record solely to confirm your clinical credentials. NPIs are public identifiers
        — they appear in federal registries and are not treated as secret credentials.
      </p>

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {submitting && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {submitting ? "Validating…" : "Submit NPI"}
      </button>
    </form>
  );
}

// ── Step 3: Plan Selection ────────────────────────────────────────────────────

function StepPlan() {
  const setSelectedPlan = useOnboardingStore((s) => s.setSelectedPlan);

  return (
    <div>
      <p className="mb-6 text-sm text-gray-600 max-w-prose">
        All plans include a <strong>14-day free trial</strong>. No credit card is charged
        until the trial period ends. You can cancel at any time from your billing portal.
      </p>
      <PlanCards
        onBeforeRedirect={(plan: PlanId) => setSelectedPlan(plan)}
      />
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { step, goToStep, nextStep, setNpiSubmitted } = useOnboardingStore();

  const currentMeta = STEPS[step - 1]!;

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-10 text-center">
          {/* Logo wordmark */}
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            Logi<span className="text-blue-600">Qo</span>
          </span>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Welcome to LogiQo MedTech
          </h1>
          <p className="mt-2 text-gray-500">
            Complete these three quick steps to unlock full platform access.
          </p>
        </div>

        {/* Card container */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-8 py-10">

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Step heading */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{currentMeta.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{currentMeta.description}</p>
          </div>

          {/* Step content */}
          {step === 1 && (
            <StepEmailVerification
              onVerified={() => goToStep(2)}
            />
          )}

          {step === 2 && (
            <StepNpi
              onSubmitted={() => setNpiSubmitted()}
            />
          )}

          {step === 3 && <StepPlan />}

          {/* Bottom nav — "Back" link when on step 2 or 3 */}
          {step > 1 && (
            <div className="mt-8 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={() => goToStep((step - 1) as 1 | 2 | 3)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to step {step - 1}
              </button>
            </div>
          )}
        </div>

        {/* Already subscribed? */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Already have a subscription?{" "}
          <a href="/dashboard" className="underline hover:text-gray-600">
            Go to dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
