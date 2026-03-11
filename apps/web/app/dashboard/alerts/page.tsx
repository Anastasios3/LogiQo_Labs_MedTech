import { apiClient } from "@/lib/api-client";
import type { Alert } from "@logiqo/shared";

export const metadata = {
  title: "Safety Alerts | LogiQo MedTech",
};

// ── Severity configuration ────────────────────────────────────────────────────
// Refactoring UI: each severity has color + icon + ARIA role.
// Inclusive Components: role="alert" for high-priority, role="status" for info.
const SEVERITY_CONFIG = {
  critical: {
    badge:     "badge-critical",
    bar:       "bg-red-600",
    role:      "alert" as const,
  },
  high: {
    badge:     "badge-high",
    bar:       "bg-orange-500",
    role:      "alert" as const,
  },
  medium: {
    badge:     "badge-medium",
    bar:       "bg-amber-400",
    role:      "status" as const,
  },
  low: {
    badge:     "badge-low",
    bar:       "bg-green-500",
    role:      "status" as const,
  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  recall:           "Recall",
  safety_notice:    "Safety Notice",
  field_correction: "Field Correction",
  hazard_alert:     "Hazard Alert",
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AlertsPage() {
  const result = await apiClient.alerts
    .list({ status: "active", limit: 50 })
    .catch(() => ({ data: [] as Alert[], total: 0, page: 1, limit: 50 }));

  const alerts              = result.data;
  const total               = result.total;
  const apiDown             = total === 0 && alerts.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Safety Alerts
            {total > 0 && (
              <span
                className="badge-recalled text-xs"
                aria-label={`${total} unacknowledged alert${total !== 1 ? "s" : ""}`}
              >
                {total} unacknowledged
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            Active recalls and safety notices for your hospital&apos;s device inventory
          </p>
        </div>
      </div>

      {/* API unavailable notice */}
      {apiDown && (
        <div className="preview-banner">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          API not reachable — start the API server and run migrations to load live alerts
        </div>
      )}

      {/* Alert list */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const severity  = (alert.severity ?? "medium") as keyof typeof SEVERITY_CONFIG;
            const s         = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;
            const typeLabel = TYPE_LABELS[alert.alertType] ?? alert.alertType;

            return (
              <article
                key={alert.id}
                role={s.role}
                aria-label={`${severity} severity ${typeLabel}: ${alert.title}`}
                className="card overflow-hidden"
              >
                {/* Left severity bar */}
                <div className="flex">
                  <div aria-hidden="true" className={`w-1 shrink-0 ${s.bar}`} />

                  <div className="flex-1 p-5">
                    {/* Header row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={s.badge}>
                          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
                          {severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </span>
                        <span className="badge-alert-type">{typeLabel}</span>
                        {alert.source && (
                          <span className="text-xs text-gray-400 font-medium">{alert.source}</span>
                        )}
                      </div>

                      {/* Acknowledge action — Safety Officer only in prod; all users in dev */}
                      <form action={`/api/alerts/${alert.id}/acknowledge`} method="post">
                        <button
                          type="submit"
                          className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                          aria-label={`Acknowledge alert: ${alert.title}`}
                        >
                          Acknowledge
                        </button>
                      </form>
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

                    {/* Date */}
                    <p className="mt-3 text-xs text-gray-400">
                      Published{" "}
                      <time dateTime={alert.publishedAt}>
                        {new Date(alert.publishedAt).toLocaleDateString("en-US", {
                          month: "long",
                          day:   "numeric",
                          year:  "numeric",
                        })}
                      </time>
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* All clear / empty state */}
      {alerts.length === 0 && !apiDown && (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg aria-hidden="true" className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="font-semibold text-gray-900">No active alerts</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Your hospital&apos;s device inventory has no outstanding recalls or safety notices.
          </p>
        </div>
      )}
    </div>
  );
}
