import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for LogiQo MedTech E2E tests.
 *
 * Dev-mode notes:
 *   - Auth0_SECRET is intentionally NOT set in the test environment, so the
 *     dashboard middleware passthrough is active and all protected routes are
 *     accessible without a real Auth0 session.
 *   - API calls to the Fastify backend are intercepted via page.route() inside
 *     each spec file, so tests run without a running backend.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  // Maximum time a single test may run
  timeout: 30_000,
  // Maximum time to wait for expect() assertions
  expect: { timeout: 8_000 },

  // Fail fast in CI; run in parallel locally
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["list"],
  ],

  use: {
    baseURL: "http://localhost:3000",
    // Traces on first retry to aid debugging
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // No AUTH0_SECRET → middleware passthrough
    extraHTTPHeaders: {},
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Explicitly unset so dev-mode bypass is active
      AUTH0_SECRET: "",
      NEXT_PUBLIC_API_URL: "http://localhost:8080",
    },
  },
});
