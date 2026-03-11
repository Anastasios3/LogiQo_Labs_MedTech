import type { Device, DeviceListResponse, Alert, AuditLog, Annotation } from "@logiqo/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    // Don't cache API responses — always fresh data
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? `API error ${res.status}`);
  }

  return res.json();
}

/** Helpers for query-string building — filters out null/undefined */
function buildQs(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return qs ? `?${qs}` : "";
}

export interface AdminStats {
  pendingDevices:  number;
  auditEventsToday: number;
  activeDevices:   number;
  activeAlerts:    number;
}

export const apiClient = {
  // ── Devices ─────────────────────────────────────────────────────────────────
  devices: {
    list: (params?: {
      q?: string;
      category?: string;
      manufacturer?: string;
      page?: number;
      limit?: number;
    }) =>
      apiFetch<DeviceListResponse>(`/devices${buildQs(params ?? {})}`),

    getById: (id: string) =>
      apiFetch<Device>(`/devices/${id}`),

    getDocumentUrl: (deviceId: string, documentId: string) =>
      apiFetch<{ url: string; expiresAt: string }>(
        `/devices/${deviceId}/documents/${documentId}/url`
      ),
  },

  // ── Alerts ───────────────────────────────────────────────────────────────────
  alerts: {
    list: (params?: { page?: number; limit?: number; status?: "active" | "acknowledged" }) =>
      apiFetch<{ data: Alert[]; total: number; page: number; limit: number }>(
        `/alerts${buildQs(params ?? {})}`
      ),

    acknowledge: (alertId: string, notes?: string) =>
      apiFetch<void>(`/alerts/${alertId}/acknowledge`, {
        method: "POST",
        body:   JSON.stringify({ notes }),
      }),
  },

  // ── Annotations ───────────────────────────────────────────────────────────────
  annotations: {
    /** Platform-wide feed (no deviceId = all visible annotations) */
    list: (params?: { deviceId?: string; page?: number; limit?: number }) =>
      apiFetch<{ data: Annotation[]; total: number; page: number; limit: number }>(
        `/annotations${buildQs(params ?? {})}`
      ),

    create: (body: {
      deviceId:       string;
      annotationType: string;
      severity?:      string;
      title:          string;
      body:           string;
      procedureType?: string;
      procedureDate?: string;
      patientCount?:  number;
      visibility?:    "tenant" | "platform";
    }) =>
      apiFetch<Annotation>("/annotations", {
        method: "POST",
        body:   JSON.stringify(body),
      }),
  },

  // ── Admin ────────────────────────────────────────────────────────────────────
  admin: {
    stats: () =>
      apiFetch<AdminStats>("/admin/stats"),

    pendingDevices: (params?: { page?: number; limit?: number }) =>
      apiFetch<DeviceListResponse>(`/admin/devices/pending${buildQs(params ?? {})}`),

    auditLogs: (params?: { page?: number; limit?: number }) =>
      apiFetch<{ data: AuditLog[]; total: number }>(
        `/admin/audit-logs${buildQs(params ?? {})}`
      ),

    approveDevice: (deviceId: string) =>
      apiFetch<void>(`/admin/devices/${deviceId}/approve`, { method: "POST" }),

    rejectDevice: (deviceId: string, reason: string) =>
      apiFetch<void>(`/admin/devices/${deviceId}/reject`, {
        method: "POST",
        body:   JSON.stringify({ reason }),
      }),
  },
};
