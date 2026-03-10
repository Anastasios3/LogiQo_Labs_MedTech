import { Device, DeviceListResponse, Alert, AuditLog } from "@logiqo/shared";

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
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? `API error ${res.status}`);
  }

  return res.json();
}

export const apiClient = {
  devices: {
    list: (params?: {
      q?: string;
      category?: string;
      manufacturer?: string;
      page?: number;
      limit?: number;
    }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<DeviceListResponse>(`/devices${qs ? `?${qs}` : ""}`);
    },

    getById: (id: string) => apiFetch<Device>(`/devices/${id}`),

    getDocumentUrl: (deviceId: string, documentId: string) =>
      apiFetch<{ url: string; expiresAt: string }>(
        `/devices/${deviceId}/documents/${documentId}/url`
      ),
  },

  alerts: {
    list: (params?: { page?: number; status?: "active" | "acknowledged" }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: Alert[]; total: number }>(`/alerts${qs ? `?${qs}` : ""}`);
    },

    acknowledge: (alertId: string, notes?: string) =>
      apiFetch<void>(`/alerts/${alertId}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
  },

  admin: {
    auditLogs: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: AuditLog[]; total: number }>(
        `/admin/audit-logs${qs ? `?${qs}` : ""}`
      );
    },

    approveDevice: (deviceId: string) =>
      apiFetch<void>(`/admin/devices/${deviceId}/approve`, { method: "POST" }),

    rejectDevice: (deviceId: string, reason: string) =>
      apiFetch<void>(`/admin/devices/${deviceId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
  },
};
