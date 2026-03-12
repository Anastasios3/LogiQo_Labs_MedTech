/**
 * Zustand store for the onboarding wizard.
 *
 * State is intentionally ephemeral (no persist middleware) — the wizard only
 * lives for the duration of the /onboarding page visit. Refreshing the page
 * resets to the first incomplete step based on live server state.
 *
 * Steps:
 *   1 — Email Verification   Check that Auth0 email_verified is true
 *   2 — NPI Submission       10-digit NPI number validated against registry
 *   3 — Subscription Plan    Choose Individual or Organisation plan
 */
import { create } from "zustand";

export type OnboardingStep = 1 | 2 | 3;

export type PlanId =
  | "individual_monthly"
  | "individual_annual"
  | "org_monthly"
  | "org_annual";

interface OnboardingState {
  /** The currently visible wizard step (1–3). */
  step: OnboardingStep;

  /** True once the backend confirms the user's NPI has been accepted (step 2). */
  npiSubmitted: boolean;

  /** The plan the user selected on step 3 before being redirected to Stripe. */
  selectedPlan: PlanId | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Jump to a specific step (used when the user clicks a completed step header). */
  goToStep: (step: OnboardingStep) => void;

  /** Advance to the next step (clamped at 3). */
  nextStep: () => void;

  /** Mark NPI as submitted and advance to step 3. */
  setNpiSubmitted: () => void;

  /** Record the selected plan before the Stripe redirect. */
  setSelectedPlan: (plan: PlanId) => void;

  /** Reset to initial state (e.g., if the user navigates back to /onboarding). */
  reset: () => void;
}

const initialState = {
  step:         1 as OnboardingStep,
  npiSubmitted: false,
  selectedPlan: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  goToStep: (step) => set({ step }),

  nextStep: () =>
    set((s) => ({ step: Math.min(s.step + 1, 3) as OnboardingStep })),

  setNpiSubmitted: () =>
    set({ npiSubmitted: true, step: 3 }),

  setSelectedPlan: (plan) =>
    set({ selectedPlan: plan }),

  reset: () => set(initialState),
}));
