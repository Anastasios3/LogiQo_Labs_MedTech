export const metadata = {
  title: "Safety Alerts | LogiQo MedTech",
};

/* ─── Severity configuration ─────────────────────────────────────────────────
   Refactoring UI: each severity has its own color + icon + ARIA role.
   Inclusive Components: role="alert" for high-priority, role="status" for info.
────────────────────────────────────────────────────────────────────────── */
const SEVERITY_CONFIG = {
  high: {
    badge:      "badge-high",
    bar:        "bg-orange-500",
    bg:         "bg-orange-50",
    border:     "border-orange-200",
    iconColor:  "text-orange-500",
    role:       "alert" as const,   // announces immediately to screen readers
  },
  medium: {
    badge:      "badge-medium",
    bar:        "bg-amber-400",
    bg:         "bg-amber-50",
    border:     "border-amber-200",
    iconColor:  "text-amber-500",
    role:       "status" as const,
  },
  low: {
    badge:      "badge-low",
    bar:        "bg-green-500",
    bg:         "bg-green-50",
    border:     "border-green-200",
    iconColor:  "text-green-600",
    role:       "status" as const,
  },
} as const;

type Severity = keyof typeof SEVERITY_CONFIG;

/* Alert type display labels */
const TYPE_LABELS: Record<string, string> = {
  recall:        "Recall",
  safety_notice: "Safety Notice",
  advisory:      "Advisory",
  hazard_alert:  "Hazard Alert",
};

/* ─── Mock data ───────────────────────────────────────────────────────────── */
const mockAlerts = [
  {
    id:           "1",
    alertType:    "recall",
    source:       "FDA MedWatch",
    title:        "Voluntary Recall: Zimmer Biomet Continuum Acetabular System",
    summary:      "Potential for early polyethylene wear due to manufacturing variance in lot Z-2024-03. Affected units may require earlier-than-expected revision surgery.",
    severity:     "high" as Severity,
    publishedAt:  "2024-03-15",
    acknowledged: false,
    affectedSkus: ["ZB-CONTINUUM-28", "ZB-CONTINUUM-32"],
  },
  {
    id:           "2",
    alertType:    "safety_notice",
    source:       "Medtronic",
    title:        "Field Safety Corrective Action: Visia AF ICD Firmware Update Required",
    summary:      "Advisory regarding battery depletion detection in firmware v2.1. Update to v2.3 required within 90 days.",
    severity:     "medium" as Severity,
    publishedAt:  "2024-02-28",
    acknowledged: true,
    affectedSkus: ["MDT-VISIA-AF-ICD-3T"],
  },
];

const unacknowledgedCount = mockAlerts.filter((a) => !a.acknowledged).length;

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AlertsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Safety Alerts
            {unacknowledgedCount > 0 && (
              /* Unacknowledged count badge — draws attention without being alarming */
              <span
                className="badge-recalled text-xs"
                aria-label={`${unacknowledgedCount} unacknowledged alert${unacknowledgedCount !== 1 ? "s" : ""}`}
              >
                {unacknowledgedCount} unacknowledged
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            Active recalls and safety notices for your hospital&apos;s device inventory
          </p>
        </div>
      </div>

      {/* Preview notice */}
      <div className="preview-banner">
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        Preview data — connect API + database for live alert ingestion
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {mockAlerts.map((alert) => {
          const s = SEVERITY_CONFIG[alert.severity];
          const typeLabel = TYPE_LABELS[alert.alertType] ?? alert.alertType;

          return (
            /*
              role="alert" → high severity: announced immediately by screen readers
              role="status" → lower severity: polite announcement (Inclusive Components)
              We avoid wrapping the whole card in role="alert" for acknowledged items
              since that would be noisy.
            */
            <article
              key={alert.id}
              role={!alert.acknowledged ? s.role : undefined}
              aria-label={`${alert.severity} severity ${typeLabel}: ${alert.title}`}
              className={[
                "card overflow-hidden transition-opacity duration-200",
                alert.acknowledged ? "opacity-60" : "",
              ].join(" ")}
            >
              {/* Severity bar — left accent strip (Refactoring UI: use borders/color for emphasis, not just badges) */}
              <div className="flex">
                <div
                  aria-hidden="true"
                  className={`w-1 shrink-0 ${s.bar}`}
                />

                <div className="flex-1 p-5">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Severity badge */}
                      <span className={s.badge}>
                        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
                        {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                      </span>

                      {/* Alert type */}
                      <span className="badge-alert-type">
                        {typeLabel}
                      </span>

                      {/* Source */}
                      <span className="text-xs text-gray-400 font-medium">
                        {alert.source}
                      </span>

                      {/* Acknowledged checkmark */}
                      {alert.acknowledged && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                          </svg>
                          Acknowledged
                        </span>
                      )}
                    </div>

                    {/* Acknowledge action */}
                    {!alert.acknowledged && (
                      <button
                        className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                        aria-label={`Acknowledge alert: ${alert.title}`}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>

                  {/* Alert title */}
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
                      <span className="text-2xs font-semibold uppercase tracking-widest text-gray-400">Affected SKUs:</span>
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

      {/* Empty state (rendered when alerts list is empty in production) */}
      {mockAlerts.length === 0 && (
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
