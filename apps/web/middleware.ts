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
 * ── Matcher ──────────────────────────────────────────────────────────────────
 *   Only dashboard routes are protected. Public routes (home, /api/auth/*,
 *   Next.js internals) are intentionally excluded.
 *   Extend the matcher as new protected top-level segments are added.
 */
import { withMiddlewareAuthRequired } from "@auth0/nextjs-auth0/edge";

export default withMiddlewareAuthRequired();

export const config = {
  matcher: [
    // Protect all dashboard sub-routes (devices, alerts, admin, annotations…)
    "/dashboard/:path*",
  ],
};
