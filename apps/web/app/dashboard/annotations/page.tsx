export const metadata = {
  title: "Peer Telemetry | LogiQo MedTech",
};

/* ─── Mock data ───────────────────────────────────────────────────────────── */
const mockAnnotations = [
  {
    id:         "1",
    deviceName: "Accolade II Hip Stem 28mm",
    deviceSku:  "STR-ACCOLADE-II-28",
    type:       "clinical_observation",
    severity:   "medium",
    title:      "Increased subsidence noted in low bone-density patients",
    body:       "Three patients with T-score < −2.5 showed 2–3 mm proximal migration at 6-week post-op. All resolved by 12 weeks without intervention. Recommend closer radiographic follow-up for osteopenic patients.",
    author:     "Dr. K. Papadopoulos, MD",
    institution:"Athens General Hospital",
    postedAt:   "2024-03-08",
    endorsements: 4,
    status:     "published",
  },
  {
    id:         "2",
    deviceName: "Visia AF ICD – 3T MRI Compatible",
    deviceSku:  "MDT-VISIA-AF-ICD-3T",
    type:       "technique_tip",
    severity:   "low",
    title:      "Optimal pocket placement reduces sensing artefacts",
    body:       "Placing the ICD pocket 2 cm medial to the standard position significantly reduced pectoral muscle sensing artefacts in 5/5 cases. No impact on lead parameters observed at 30-day check.",
    author:     "Dr. M. Alexiou, MD",
    institution:"Hippocration Hospital",
    postedAt:   "2024-03-05",
    endorsements: 9,
    status:     "published",
  },
  {
    id:         "3",
    deviceName: "Triathlon Knee System",
    deviceSku:  "STR-TRIATHLON-KS-65",
    type:       "adverse_event",
    severity:   "high",
    title:      "Patellar clunk syndrome at 4-month follow-up",
    body:       "One patient presented with patellar clunk at 4 months. Managed conservatively with physiotherapy; resolved at 6 months. Suspected cause: residual fibrous tissue at proximal pole. No implant defect identified.",
    author:     "Dr. A. Stavros, MD",
    institution:"Euromedica",
    postedAt:   "2024-02-20",
    endorsements: 2,
    status:     "pending_review",
  },
];

/* ─── Type/severity configuration ─────────────────────────────────────────── */
const TYPE_CONFIG: Record<string, { badge: string; label: string }> = {
  clinical_observation: { badge: "badge-info",   label: "Clinical Observation" },
  technique_tip:        { badge: "badge-low",    label: "Technique Tip"        },
  adverse_event:        { badge: "badge-high",   label: "Adverse Event"        },
  device_comparison:    { badge: "badge-medium", label: "Device Comparison"    },
};

const SEVERITY_DOT: Record<string, string> = {
  high:   "bg-orange-500",
  medium: "bg-amber-400",
  low:    "bg-emerald-500",
};

const STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  published:      { badge: "badge-approved", label: "Published"      },
  pending_review: { badge: "badge-pending",  label: "Pending Review" },
  rejected:       { badge: "badge-recalled", label: "Rejected"       },
};

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function AnnotationsPage() {
  const publishedCount = mockAnnotations.filter((a) => a.status === "published").length;
  const pendingCount   = mockAnnotations.filter((a) => a.status === "pending_review").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Peer Telemetry</h1>
          <p className="page-subtitle">
            Clinician-reported observations, technique tips, and adverse events — peer reviewed
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-card">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="font-semibold text-gray-900">{publishedCount}</span>
            <span className="text-gray-500">Published</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 shadow-card">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              <span className="font-semibold text-amber-900">{pendingCount}</span>
              <span className="text-amber-700">Pending review</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview notice */}
      <div className="preview-banner">
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        Preview data — connect API + database for live peer annotations
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{mockAnnotations.length}</span> annotations across 3 devices
        </p>
        <button
          className="btn-primary"
          aria-label="Submit a new clinical annotation"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Submit Annotation
        </button>
      </div>

      {/* Annotation list */}
      <div className="space-y-3">
        {mockAnnotations.map((ann) => {
          const typeConf   = TYPE_CONFIG[ann.type]   ?? { badge: "badge-info", label: ann.type };
          const statusConf = STATUS_CONFIG[ann.status] ?? { badge: "badge-inactive", label: ann.status };
          const dot        = SEVERITY_DOT[ann.severity] ?? "bg-gray-400";

          return (
            <article
              key={ann.id}
              className="card overflow-hidden"
              aria-label={`${typeConf.label} by ${ann.author}: ${ann.title}`}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Type badge */}
                    <span className={typeConf.badge}>
                      {typeConf.label}
                    </span>

                    {/* Severity dot */}
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
                      {ann.severity.charAt(0).toUpperCase() + ann.severity.slice(1)} severity
                    </span>

                    {/* Review status */}
                    <span className={statusConf.badge}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Endorsements */}
                  <button
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-surface-muted hover:border-brand-300 hover:text-brand-700 transition-colors"
                    aria-label={`Endorse annotation: ${ann.endorsements} endorsements`}
                  >
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053a4.5 4.5 0 0 1 1.423.23l.17.057" />
                    </svg>
                    {ann.endorsements}
                    {ann.endorsements === 1 ? " endorsement" : " endorsements"}
                  </button>
                </div>

                {/* Device reference */}
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                  </svg>
                  <span className="font-medium text-gray-700">{ann.deviceName}</span>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-2xs text-gray-500">
                    {ann.deviceSku}
                  </code>
                </div>

                {/* Title */}
                <h2 className="mt-3 font-semibold text-gray-900 leading-snug">
                  {ann.title}
                </h2>

                {/* Body */}
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {ann.body}
                </p>

                {/* Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {/* Author avatar */}
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-bold text-brand-700"
                    >
                      {ann.author.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium text-gray-700">{ann.author}</span>
                    <span className="text-gray-400">·</span>
                    <span>{ann.institution}</span>
                  </div>

                  <time
                    dateTime={ann.postedAt}
                    className="text-xs text-gray-400"
                  >
                    Posted{" "}
                    {new Date(ann.postedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day:   "numeric",
                      year:  "numeric",
                    })}
                  </time>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* CTA for clinicians */}
      <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg aria-hidden="true" className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Share your clinical experience</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-sm">
            Verified clinicians can submit peer-reviewed observations.
            All submissions are reviewed before publication.
          </p>
        </div>
        <button
          className="btn-primary"
          aria-label="Submit a new clinical annotation"
        >
          Submit an annotation
        </button>
      </div>
    </div>
  );
}
