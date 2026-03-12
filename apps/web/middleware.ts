/**
 * Next.js edge middleware — session-expired 401 redirect.
 *
 * Uses Auth0's withMiddlewareAuthRequired to verify that the user has a valid
 * Auth0 session before any protected page renders. If the session is missing or
 * expired, the middleware redirects to /api/auth/login BEFORE the page (or any
 * API call inside it) is reached.
 *
 * ── What this handles ───────────────────────────────────────────────────────
 *   Standard session-expired 401 — user's Auth0 token is gone or expired.
 *   The middleware catches this at the routing layer, so no API call is made
 *   and no ApiError is thrown. The user sees the login page, not a 401 UI.
 *
 * ── What this does NOT handle ────────────────────────────────────────────────
 *   USER_NOT_PROVISIONED 401 — the user HAS a valid Auth0 session (middleware
 *   passes them through) but our DB has no row for them. This typically means:
 *     - A race between the Auth0 callback and /auth/register's DB insert
 *     - A failed registration that provisioned Auth0 but not our DB
 *   The middleware cannot distinguish this from a legitimate session; the
 *   ApiError with code "USER_NOT_PROVISIONED" is caught by individual page
 *   components, which should render a "registration incomplete, please contact
 *   support" message rather than redirecting to login.
 *
 *   SUBSCRIPTION_REQUIRED 402 — also passes through this middleware (valid
 *   session); handled inline by components or the /subscribe redirect.
 *
 * ── Dev-mode bypass ──────────────────────────────────────────────────────────
 *   withMiddlewareAuthRequired() reads AUTH0_SECRET eagerly in the edge
 *   runtime and throws "secret is not allowed to be empty" if the variable is
 *   absent or an empty string. This matches the dev-mode check used in
 *   dashboard/layout.tsx (`if (!process.env.AUTH0_SECRET) return DEV_USER`).
 *
 *   When AUTH0_SECRET is unset, the middleware exports a passthrough handler
 *   (NextResponse.next()) so every matched route proceeds to the page component
 *   without session validation. Individual pages still render their own dev-mode
 *   mock data (DEV_USER in the layout, useUser() stub in client components).
 *
 *   This bypass MUST NOT reach production — AUTH0_SECRET is always set in the
 *   Vercel environment and on ECS Fargate, so the real handler is used there.
 *
 * ── Matcher ──────────────────────────────────────────────────────────────────
 *   Only dashboard, onboarding, and subscribe routes are protected. Public
 *   routes (home, /api/auth/*, Next.js internals) are intentionally excluded.
 *   Extend the matcher as new protected top-level segments are added.
 */
import { withMiddlewareAuthRequired } from "@auth0/nextjs-auth0/edge";
import { NextResponse }               from "next/server";

// ── Handler selection ─────────────────────────────────────────────────────────
//
// AUTH0_SECRET presence is the canonical dev-mode signal, consistent with
// dashboard/layout.tsx. The conditional is evaluated at module load time;
// Next.js inlines process.env at build/start so both branches are reachable.
//
// No explicit type annotation: TypeScript infers the union of both branches.
// NextMiddleware accepts (request, event); the passthrough ignores both
// arguments (fewer params is always assignable in callback position).
export default process.env.AUTH0_SECRET
  ? withMiddlewareAuthRequired()
  : function devPassthrough() { return NextResponse.next(); };

export const config = {
  matcher: [
    // Protect all dashboard sub-routes (devices, alerts, admin, annotations…)
    "/dashboard/:path*",
    // Onboarding wizard — requires a valid session to read email_verified / NPI status
    "/onboarding",
    "/onboarding/:path*",
    // Subscription management — requires a valid session to open Stripe Checkout / Portal
    "/subscribe",
    "/subscribe/:path*",
  ],
};
