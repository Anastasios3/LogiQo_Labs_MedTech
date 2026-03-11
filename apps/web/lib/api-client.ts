import type {
  Device, DeviceListResponse, Alert, AuditLog, Annotation,
  IngestionRun, TenantDataSources, GudidDeviceInfo,
  AnnotationVote, Comment, AnnotationFlag, AnnotationTag,
  User, UserReputation,
} from "@logiqo/shared";

// Server components reach Fastify directly; browser client components use the
// Next.js rewrite proxy (/api/backend → localhost:8080) to avoid cross-port issues.
const API_BASE =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL ?? "http://localhost:8080")
    : "/api/backend";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      // Only attach Content-Type when there is a body — Fastify's strict JSON
      // body parser rejects requests with 'application/json' but no body.
      ...(options?.body != null ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? `API error ${res.status}`);
  }

  return res.json();
}

function buildQs(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return qs ? `?${qs}` : "";
}

export interface AdminStats {
  pendingDevices:   number;
  auditEventsToday: number;
  activeDevices:    number;
  activeAlerts:     number;
}

export interface DeviceMeta {
  manufacturers: { id: string; name: string; slug: string }[];
  categories:    { id: string; name: string; code: string }[];
}

export const apiClient = {
  // ── Devices ─────────────────────────────────────────────────────────────────
  devices: {
    list: (params?: {
      q?: string;
      category?: string;
      manufacturer?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) =>
      apiFetch<DeviceListResponse>(`/devices${buildQs(params ?? {})}`),

    getById: (id: string) =>
      apiFetch<Device>(`/devices/${id}`),

    meta: () =>
      apiFetch<DeviceMeta>("/devices/meta"),

    create: (body: {
      sku:                 string;
      name:                string;
      manufacturerId:      string;
      categoryId:          string;
      description?:        string;
      modelNumber?:        string;
      regulatoryStatus?:   string;
      sterilizationMethod?: string;
      fdA510kNumber?:      string;
      ceMmarkNumber?:      string;
    }) =>
      apiFetch<Device>("/devices", {
        method: "POST",
        body:   JSON.stringify(body),
      }),

    getDocumentUrl: (deviceId: string, documentId: string) =>
      apiFetch<{ url: string; expiresAt: string }>(
        `/devices/${deviceId}/documents/${documentId}/url`
      ),

    gudidLookup: (udi: string) =>
      apiFetch<GudidDeviceInfo>(`/devices/gudid-lookup?udi=${encodeURIComponent(udi)}`),
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
    list: (params?: {
      deviceId?: string;
      sort?:     "top" | "newest" | "discussed";
      tag?:      string;
      type?:     string;
      severity?: string;
      page?:     number;
      limit?:    number;
    }) =>
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
      tags?:          string[];
    }) =>
      apiFetch<Annotation>("/annotations", {
        method: "POST",
        body:   JSON.stringify(body),
      }),

    // Votes
    castVote: (annotationId: string, value: -1 | 1) =>
      apiFetch<{ voteScore: number }>(`/annotations/${annotationId}/votes`, {
        method: "POST",
        body:   JSON.stringify({ value }),
      }),

    removeVote: (annotationId: string) =>
      apiFetch<void>(`/annotations/${annotationId}/votes`, { method: "DELETE" }),

    // Comments
    listComments: (annotationId: string) =>
      apiFetch<Comment[]>(`/annotations/${annotationId}/comments`),

    addComment: (annotationId: string, body: { body: string; parentId?: string }) =>
      apiFetch<Comment>(`/annotations/${annotationId}/comments`, {
        method: "POST",
        body:   JSON.stringify(body),
      }),

    castCommentVote: (annotationId: string, commentId: string, value: -1 | 1) =>
      apiFetch<{ ok: boolean }>(`/annotations/${annotationId}/comments/${commentId}/votes`, {
        method: "POST",
        body:   JSON.stringify({ value }),
      }),

    removeCommentVote: (annotationId: string, commentId: string) =>
      apiFetch<void>(`/annotations/${annotationId}/comments/${commentId}/votes`, {
        method: "DELETE",
      }),

    // Flags
    flag: (annotationId: string, body: { reason: string; notes?: string }) =>
      apiFetch<AnnotationFlag>(`/annotations/${annotationId}/flags`, {
        method: "POST",
        body:   JSON.stringify(body),
      }),
  },

  // ── Users / Verification ──────────────────────────────────────────────────────
  users: {
    me: () => apiFetch<User & { userReputation?: UserReputation }>("/users/me"),

    submitNpi: (npiNumber: string) =>
      apiFetch<{ message: string; verificationTier: number; npiNumber: string }>(
        "/users/me/verification",
        { method: "PATCH", body: JSON.stringify({ npiNumber }) }
      ),
  },

  // ── Ingestion ────────────────────────────────────────────────────────────────
  ingestion: {
    syncFdaRecalls: () =>
      apiFetch<IngestionRun>("/ingestion/sync/fda-recalls", { method: "POST" }),

    syncFda510k: () =>
      apiFetch<IngestionRun>("/ingestion/sync/fda-510k", { method: "POST" }),

    testGudid: () =>
      apiFetch<{ ok: boolean; message: string }>("/ingestion/sync/gudid-test", { method: "POST" }),

    testEudamed: () =>
      apiFetch<{ ok: boolean; message: string; requiresRegistration?: boolean }>("/ingestion/sync/eudamed-test", { method: "POST" }),

    runs: (params?: { page?: number; limit?: number; source?: string }) =>
      apiFetch<{ data: IngestionRun[]; total: number; page: number; limit: number }>(
        `/ingestion/runs${buildQs(params ?? {})}`
      ),
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    get: () =>
      apiFetch<TenantDataSources>("/settings"),

    patch: (body: Partial<TenantDataSources>) =>
      apiFetch<TenantDataSources>("/settings", {
        method: "PATCH",
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

    // User verification management
    users: (params?: { tier?: number; page?: number; limit?: number }) =>
      apiFetch<{ data: (User & { userReputation?: UserReputation })[]; total: number; page: number; limit: number }>(
        `/admin/users${buildQs(params ?? {})}`
      ),

    setUserTier: (userId: string, tier: 0 | 1 | 2 | 3, reason?: string) =>
      apiFetch<User>(`/admin/users/${userId}/tier`, {
        method: "PATCH",
        body:   JSON.stringify({ tier, reason }),
      }),

    // Open flags for moderation queue
    resolveFlag: (annotationId: string, flagId: string, resolution: string) =>
      apiFetch<void>(`/annotations/${annotationId}/flags/${flagId}`, {
        method: "PATCH",
        body:   JSON.stringify({ resolution }),
      }),
  },
};
