/**
 * Shared Playwright helpers and mock data factories.
 *
 * All API calls are intercepted via page.route() so tests run without a real
 * Fastify backend. Helpers expose thin wrappers that make intercepting
 * consistent across spec files.
 */
import type { Page, Route } from "@playwright/test";

// ── Types mirroring shared package ───────────────────────────────────────────

export interface MockDevice {
  id: string;
  sku: string;
  name: string;
  status: string;
  approvalStatus: string;
  manufacturer: { id: string; name: string };
  category: { id: string; name: string };
  description: string;
  regulatoryStatus: string;
  fdA510kNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockAnnotation {
  id: string;
  deviceId: string;
  title: string;
  body: string;
  annotationType: string;
  severity: string;
  visibility: string;
  status: string;
  createdAt: string;
  author: { id: string; fullName: string; specialty: string };
  device: { id: string; name: string; sku: string };
  _count: { endorsements: number; flags: number };
}

export interface MockAlert {
  id: string;
  title: string;
  summary: string;
  alertType: string;
  severity: string;
  source: string;
  publishedAt: string;
  acknowledged: boolean;
  isUnread: boolean;
  affectedDeviceCount: number;
  affectedDevices: { id: string; name: string; sku: string }[];
  acknowledgedAt: string | null;
  acknowledgedBy: null | { fullName: string; specialty: string };
}

export interface MockAuditLog {
  id: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  responseStatus: number;
  ipAddress: string;
  userAgent: string;
  oldValues: null;
  newValues: null;
}

// ── Mock data factories ───────────────────────────────────────────────────────

export function makeDevice(overrides: Partial<MockDevice> = {}): MockDevice {
  return {
    id: "dev-001",
    sku: "SKU-HR-001",
    name: "Titanium Hip Stem Pro",
    status: "active",
    approvalStatus: "approved",
    manufacturer: { id: "mfr-001", name: "OrthoTech Solutions" },
    category: { id: "cat-001", name: "Hip Replacement" },
    description: "High-performance titanium hip stem for primary THA procedures.",
    regulatoryStatus: "510k_cleared",
    fdA510kNumber: "K231234",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-02-20T14:30:00.000Z",
    ...overrides,
  };
}

export function makeAnnotation(overrides: Partial<MockAnnotation> = {}): MockAnnotation {
  return {
    id: "ann-001",
    deviceId: "dev-001",
    title: "Optimal Cementing Technique",
    body: "Using low-viscosity cement with pressurization yields consistent fixation.",
    annotationType: "clinical_note",
    severity: "low",
    visibility: "platform",
    status: "published",
    createdAt: "2024-03-01T09:00:00.000Z",
    author: { id: "user-001", fullName: "Dr. Sarah Jensen", specialty: "Orthopedic Surgery" },
    device: { id: "dev-001", name: "Titanium Hip Stem Pro", sku: "SKU-HR-001" },
    _count: { endorsements: 12, flags: 0 },
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<MockAlert> = {}): MockAlert {
  return {
    id: "alert-001",
    title: "Class II Recall — Hip Stem Titanium Pro",
    summary: "Potential micro-fracture under extreme load conditions in batch B2024.",
    alertType: "recall",
    severity: "high",
    source: "FDA MedWatch",
    publishedAt: "2024-03-10T12:00:00.000Z",
    acknowledged: false,
    isUnread: true,
    affectedDeviceCount: 1,
    affectedDevices: [{ id: "dev-001", name: "Titanium Hip Stem Pro", sku: "SKU-HR-001" }],
    acknowledgedAt: null,
    acknowledgedBy: null,
    ...overrides,
  };
}

export function makeAuditLog(overrides: Partial<MockAuditLog> = {}): MockAuditLog {
  return {
    id: "log-001",
    createdAt: new Date().toISOString(),
    userId: "user-001",
    userEmail: "dev@logiqo.io",
    userRole: "hospital_safety_officer",
    action: "device.viewed",
    resourceType: "device",
    resourceId: "dev-001",
    responseStatus: 200,
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0 (Playwright)",
    oldValues: null,
    newValues: null,
    ...overrides,
  };
}

// ── Route interceptors ────────────────────────────────────────────────────────

/** Intercept all Fastify API calls and respond with fixture data. */
export async function mockApiRoute(
  page: Page,
  path: string,
  body: unknown,
  status = 200,
) {
  await page.route(`**/api/**${path}**`, async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/** Intercept the Fastify backend directly (port 8080). */
export async function mockBackend(
  page: Page,
  urlPattern: string | RegExp,
  body: unknown,
  status = 200,
) {
  await page.route(urlPattern, async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/**
 * Navigate to a page and wait for a readiness selector to be present.
 *
 * @param page     Playwright Page object.
 * @param path     Relative URL to navigate to (e.g. "/dashboard/devices").
 * @param selector CSS selector to wait for after navigation.
 *                 Defaults to "#main-content" (present on all dashboard pages).
 *                 Pass an alternative for routes that render a different root:
 *                 - Landing page: "h1"
 *                 - Onboarding:   "form, [data-step]"
 *                 - Auth0 pages:  pass null to skip the readiness wait.
 */
export async function gotoDashboard(
  page: Page,
  path: string,
  selector: string | null = "#main-content",
) {
  await page.goto(path);
  if (selector !== null) {
    await page.waitForSelector(selector, { timeout: 15_000 });
  }
}
