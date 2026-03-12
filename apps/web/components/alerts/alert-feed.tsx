"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AlertWithStatus } from "@logiqo/shared";

// ── Severity config ────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { badge: "badge-critical", bar: "bg-red-600"    },
  high:     { badge: "badge-high",     bar: "bg-orange-500" },
  medium:   { badge: "badge-medium",   bar: "bg-amber-400"  },
  low:      { badge: "badge-low",      bar: "bg-green-500"  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  recall:           "Recall",
  safety_notice:    "Safety Notice",
  field_correction: "Field Correction",
  hazard_alert:     "Hazard Alert",
};

const PAGE_SIZE = 20;

// ── Alert card ─────────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onAcknowledge,
  acknowledging,
}: {
  alert: AlertWithStatus;
  onAcknowledge: (id: string) => void;
  acknowledging: boolean;
}) {
  const severity  = (alert.severity ?? "medium") as keyof typeof SEVERITY_CONFIG;
  const s         = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
  const typeLabel = TYPE_LABELS[alert.alertType] ?? alert.alertType;

  return (
    <article
      className="card overflow-hidden"
      aria-label={`${severity} ${typeLabel}: ${alert.title}`}
    >
      <div className="flex">
        {/* Left severity bar */}
        <div aria-hidden="true" className={`w-1 shrink-0 ${s.bar}`} />

        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {alert.isUnread && (
                <span
                  aria-label="Unread"
                  className="h-2 w-2 rounded-full bg-brand-600 shrink-0"
                />
              )}
              <span className={s.badge}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </span>
              <span className="badge-alert-type">{typeLabel}</span>
              {alert.source && (
                <span className="text-xs text-gray-400 font-medium">{alert.source}</span>
              )}
            </div>

            {!alert.acknowledged && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                disabled={acknowledging}
                className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                aria-label={`Acknowledge: ${alert.title}`}
              >
                {acknowledging ? "Acknowledging…" : "Acknowledge"}
              </button>
            )}

            {alert.acknowledged && alert.acknowledgedBy && (
              <span className="badge-approved text-xs shrink-0">
                Acknowledged
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="mt-3 font-semibold text-gray-900 leading-snug">
            {alert.title}
          </h2>

          {/* Summary */}
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
            {alert.summary}
          </p>

          {/* Affected SKUs */}
          {alert.affectedSkus && alert.affectedSkus.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-widest text-gray-400">
                Affected SKUs:
              </span>
              {alert.affectedSkus.map((sku) => (
                <code
                  key={sku}
                  className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-2xs text-gray-600"
                >
                  {sku}
                </code>
              ))}
            </div>
          )}

          {/* Affected devices */}
          {alert.affectedDeviceCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-widest text-gray-400">
                Affected devices:
              </span>
              {alert.affectedDevices.slice(0, 4).map((d) => (
                <span
                  key={d.id}
                  className="rounded bg-orange-50 px-1.5 py-0.5 text-2xs text-orange-700 font-medium ring-1 ring-inset ring-orange-200"
                >
                  {d.name}
                </span>
              ))}
              {alert.affectedDeviceCount > 4 && (
                <span className="text-2xs text-gray-400">
                  +{alert.affectedDeviceCount - 4} more
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <p className="text-xs text-gray-400">
              Published{" "}
              <time dateTime={alert.publishedAt}>
                {new Date(alert.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day:   "numeric",
                  year:  "numeric",
                })}
              </time>
            </p>

            {alert.acknowledged && alert.acknowledgedBy && (
              <p className="text-xs text-gray-400">
                Acknowledged by{" "}
                <span className="font-medium text-gray-600">
                  {alert.acknowledgedBy.fullName}
                  {alert.acknowledgedBy.specialty
                    ? ` (${alert.acknowledgedBy.specialty})`
                    : ""}
                </span>
                {alert.acknowledgedAt && (
                  <>
                    {" · "}
                    <time dateTime={alert.acknowledgedAt}>
                      {new Date(alert.acknowledgedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day:   "numeric",
                      })}
                    </time>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── AlertFeed ──────────────────────────────────────────────────────────────────

export function AlertFeed() {
  const [filter, setFilter]             = useState<"active" | "acknowledged">("active");
  const [page, setPage]                 = useState(1);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", filter, page],
    queryFn:  () => apiClient.alerts.list({ status: filter, page, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      setAcknowledgingId(alertId);
      return apiClient.alerts.acknowledge(alertId);
    },
    onSettled: () => {
      setAcknowledgingId(null);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const alerts     = data?.data    ?? [];
  const total      = data?.total   ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFilterChange = (f: "active" | "acknowledged") => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2" role="tablist" aria-label="Alert status filter">
          {(["active", "acknowledged"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={filter === tab}
              onClick={() => handleFilterChange(tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                filter === tab
                  ? "bg-brand-600 text-white shadow-card"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "active" && total > 0 && filter === "active" && (
                <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold">
                  {total}
                </span>
              )}
            </button>
          ))}
        </div>

        {total > 0 && (
          <p className="text-xs text-gray-400 tabular-nums">
            {total} alert{total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Alert list */}
      {!isLoading && alerts.length > 0 && (
        <div className="space-y-3" role="list">
          {alerts.map((alert) => (
            <div key={alert.id} role="listitem">
              <AlertCard
                alert={alert}
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                acknowledging={acknowledgingId === alert.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && alerts.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg aria-hidden="true" className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="font-semibold text-gray-900">
            {filter === "active" ? "No active alerts" : "No acknowledged alerts"}
          </h2>
          <p className="text-sm text-gray-500 max-w-xs">
            {filter === "active"
              ? "Your hospital's device inventory has no outstanding recalls or safety notices."
              : "No alerts have been acknowledged yet."}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 tabular-nums">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
