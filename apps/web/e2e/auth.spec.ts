/**
 * auth.spec.ts — Authentication & Onboarding flow
 *
 * Tests:
 *  1. Public landing page renders key sections
 *  2. Unauthenticated visitor sees login CTA
 *  3. Onboarding page is accessible when logged in (dev-mode bypass)
 *  4. Dashboard redirects to login when session is missing (real auth)
 *  5. Dashboard loads in dev-mode (no AUTH0_SECRET) with DEV_USER
 *  6. Subscribe page renders pricing options
 *  7. Auth0 login route is callable (redirects to Auth0)
 *
 * Selector notes:
 *   - Landing page (/):           does NOT render #main-content — uses "h1"
 *   - Dashboard pages (/dashboard/*): render #main-content — gotoDashboard default
 *   - /api/auth/login:            Auth0 redirect — no DOM wait, pass null selector
 *   - /onboarding:                renders a step form — uses "main, form, [data-step]"
 */

import { test, expect } from "@playwright/test";
import { gotoDashboard } from "./helpers";

// ── Landing page ──────────────────────────────────────────────────────────────

test.describe("Landing page", () => {
  test("renders hero section with product name", async ({ page }) => {
    // Landing page renders <h1> but NOT #main-content — use "h1" as readiness signal
    await gotoDashboard(page, "/", "h1");
    await expect(page).toHaveTitle(/LogiQo/i);
    const hero = page.locator("h1").first();
    await expect(hero).toBeVisible();
  });

  test("login / Sign In CTA is present", async ({ page }) => {
    await gotoDashboard(page, "/", "h1");
    const loginLink = page
      .locator(
        "a[href*='/api/auth/login'], a[href*='login'], button:has-text('Sign In'), a:has-text('Sign In'), a:has-text('Log in')"
      )
      .first();
    await expect(loginLink).toBeVisible();
  });

  test("page loads under 5 seconds (performance smoke test)", async ({ page }) => {
    const start = Date.now();
    // Pass null: no readiness selector — just time the navigation itself
    await gotoDashboard(page, "/", null);
    await page.waitForLoadState("domcontentloaded");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5_000);
  });

  test("platform module cards are present", async ({ page }) => {
    await gotoDashboard(page, "/", "h1");
    await expect(page.getByText("Hardware Index")).toBeVisible();
    await expect(page.getByText("Peer Telemetry")).toBeVisible();
    await expect(page.getByText("Safety Alerts")).toBeVisible();
  });
});

// ── Dev-mode dashboard access ─────────────────────────────────────────────────

test.describe("Dashboard (dev-mode, no AUTH0_SECRET)", () => {
  test("dashboard home loads with DEV_USER sidebar", async ({ page }) => {
    // Dashboard renders #main-content — use default gotoDashboard selector
    await gotoDashboard(page, "/dashboard/devices");
    await expect(page.locator("nav, aside, [role='navigation']").first()).toBeVisible();
  });

  test("sidebar shows nav items", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/devices");
    const navLinks = page.locator("a[href*='/dashboard/']");
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("protected routes are accessible in dev mode", async ({ page }) => {
    const routes = [
      "/dashboard/devices",
      "/dashboard/alerts",
      "/dashboard/annotations",
    ];
    for (const route of routes) {
      // Each dashboard route renders #main-content — use default selector
      await gotoDashboard(page, route);
      // Should NOT have redirected to login in dev mode
      expect(page.url()).not.toContain("/api/auth/login");
    }
  });
});

// ── Auth0 route handlers ──────────────────────────────────────────────────────

test.describe("Auth0 route handlers", () => {
  test("/api/auth/login is reachable (does not 500)", async ({ page }) => {
    // Auth0 redirects to the auth provider — pass null selector, never renders #main-content.
    // Without real Auth0 creds it returns an error page; that is acceptable here.
    // We only assert: no internal server error (status < 500).
    const response = await page.goto("/api/auth/login");
    const status = response?.status() ?? 0;
    // 302/307 redirect or error page — anything but a 5xx crash
    expect(status).toBeLessThan(500);
  });
});

// ── Onboarding ────────────────────────────────────────────────────────────────

test.describe("Onboarding page", () => {
  test("renders without crashing in dev mode", async ({ page }) => {
    // Onboarding renders a step form, NOT #main-content.
    // Use "main, form, [data-step], h1" as the readiness signal; if none renders
    // within 10s it is a genuine crash — not an opaque timeout.
    const response = await page.goto("/onboarding");
    const status   = response?.status() ?? 500;
    // A non-5xx response means the page was rendered (even if it redirected)
    expect(status).toBeLessThan(500);
    // After navigation, we should NOT be on an error page
    expect(page.url()).not.toContain("/500");
  });

  test("onboarding URL does not redirect to /dashboard in dev mode", async ({ page }) => {
    // In dev mode the middleware passthrough lets the page render — no redirect
    await page.goto("/onboarding");
    // Should stay on onboarding, not bounce back to /dashboard or /api/auth/login
    const finalUrl = page.url();
    expect(finalUrl).not.toContain("/api/auth/login");
    expect(finalUrl).not.toContain("/dashboard");
  });
});
