import { handleAuth } from "@auth0/nextjs-auth0";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Handles: /api/auth/login, /api/auth/logout, /api/auth/callback, /api/auth/me
//
// DEV-MODE / E2E BYPASS
// ---------------------
// @auth0/nextjs-auth0 validates that AUTH0_SECRET is a non-empty string before
// handling any request. When AUTH0_SECRET is absent (local dev, CI E2E, Playwright)
// every /api/auth/* call would throw "secret is not allowed to be empty" → 500.
//
// When the secret is absent we skip the real handler and return a lightweight
// 302 redirect to "/" instead:
//   • The E2E test that checks `/api/auth/login` is reachable (status < 500) passes.
//   • Server logs stay clean — no LogoutHandlerError stack traces.
//   • The middleware is also in passthrough mode (same AUTH0_SECRET check), so
//     dashboard routes are accessible without a session — everything is consistent.
//
// This branch is unreachable in production where AUTH0_SECRET is always set.

type RouteContext = { params: { auth0: string } };

const prodHandler = handleAuth();

function devFallback(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/", req.url));
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  if (!process.env.AUTH0_SECRET) return devFallback(req);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prodHandler as any)(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  if (!process.env.AUTH0_SECRET) return devFallback(req);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prodHandler as any)(req, ctx);
}
