export const metadata = {
  title: "Admin Dashboard | LogiQo MedTech",
};

/* ─── Mock data ───────────────────────────────────────────────────────────── */
const mockPending = [
  {
    id:           "2",
    name:         "Visia AF ICD – 3T MRI Compatible",
    sku:          "MDT-VISIA-AF-ICD-3T",
    manufacturer: "Medtronic",
    submitted:    "2024-03-01",
    submittedBy:  "it@hospital.org",
  },
];

const mockLogs = [
  {
    id:       "1",
    ts:       "2024-03-10T14:22:01Z",
    email:    "surgeon@hospital.org",
    action:   "device.viewed",
    resource: "device:STR-ACCOLADE",
    ip:       "10.0.1.42",
  },
  {
    id:       "2",
    ts:       "2024-03-10T14:20:15Z",
    email:    "safety@hospital.org",
    action:   "alert.acknowledged",
    resource: "alert:Z-1234-2024",
    ip:       "10.0.1.11",
  },
  {
    id:       "3",
    ts:       "2024-03-10T14:18:33Z",
    email:    "surgeon@hospital.org",
    action:   "document.downloaded",
    resource: "device_document:IFU-001",
    ip:       "10.0.1.42",
  },
];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
    hour12:  false,
  });
}

/* Action badge — colour-codes event types for fast scanning
   (Refactoring UI: use color intentionally to communicate meaning) */
function ActionBadge({ action }: { action: string }) {
  const [domain, verb] = action.split(".");
  const colors: Record<string, string> = {
    device:   "bg-brand-50 text-brand-700 ring-brand-200",
    alert:    "bg-amber-50 text-amber-700 ring-amber-200",
    document: "bg-violet-50 text-violet-700 ring-violet-200",
    admin:    "bg-rose-50 text-rose-700 ring-rose-200",
  };
  const cls = colors[domain] ?? "bg-gray-100 text-gray-600 ring-gray-200";

  return (
    <span className={`badge ring-1 ring-inset ${cls} font-mono tracking-normal`}>
      {domain}
      <span className="text-current opacity-50">.</span>
      {verb}
    </span>
  );
}

/* ─── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className={`stat-card ${accent ?? ""}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AdminPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Device approvals, SOP management, and compliance audit logs
          </p>
        </div>
      </div>

      {/* Preview notice */}
      <div className="preview-banner">
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        Preview data — connect API + database for live data
      </div>

      {/* Stats row — quick operational overview (Refactoring UI: surface key numbers prominently) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pending Approvals" value={mockPending.length} sub="Awaiting review" />
        <StatCard label="Audit Events Today" value={mockLogs.length} sub="Last 24 h" />
        <StatCard label="Active Devices" value={3} sub="In hospital index" />
        <StatCard label="Active Alerts" value={1} sub="Unacknowledged" accent="border-orange-200" />
      </div>

      {/* ── Pending Approvals ─────────────────────────────────────────────── */}
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-4">
          Pending Device Approvals
        </h2>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Devices awaiting approval">
              <caption className="sr-only">
                Devices submitted for review, awaiting safety officer approval
              </caption>
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">Manufacturer</th>
                  <th scope="col">Submitted by</th>
                  <th scope="col">Date</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {mockPending.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <p className="font-semibold text-gray-900">{device.name}</p>
                      <p className="font-mono text-2xs text-gray-400 mt-0.5">{device.sku}</p>
                    </td>
                    <td className="text-gray-700">{device.manufacturer}</td>
                    <td className="text-sm text-gray-500">{device.submittedBy}</td>
                    <td>
                      <time className="text-sm text-gray-500" dateTime={device.submitted}>
                        {new Date(device.submitted).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </time>
                    </td>
                    <td>
                      {/* Action buttons — Inclusive Components: descriptive labels */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="btn-primary text-xs px-3 py-1.5"
                          aria-label={`Approve ${device.name}`}
                        >
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Approve
                        </button>
                        <button
                          className="btn-danger text-xs px-3 py-1.5"
                          aria-label={`Reject ${device.name}`}
                        >
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mockPending.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              No pending approvals — all caught up!
            </div>
          )}
        </div>
      </section>

      {/* ── Audit Log ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="audit-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="audit-heading">Audit Log</h2>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            Immutable — no edits or deletions possible
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Immutable compliance audit log">
              <caption className="sr-only">
                Immutable audit log of all user actions, showing timestamp, user, action type, affected resource, and IP address
              </caption>
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">User</th>
                  <th scope="col">Action</th>
                  <th scope="col">Resource</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {mockLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <time
                        dateTime={log.ts}
                        className="font-mono text-xs text-gray-500 whitespace-nowrap tabular-nums"
                      >
                        {formatTimestamp(log.ts)}
                      </time>
                    </td>
                    <td>
                      <span className="text-sm text-gray-700">{log.email}</span>
                    </td>
                    <td>
                      <ActionBadge action={log.action} />
                    </td>
                    <td>
                      <code className="font-mono text-xs text-gray-600 bg-surface-muted px-1.5 py-0.5 rounded">
                        {log.resource}
                      </code>
                    </td>
                    <td>
                      <code className="font-mono text-xs text-gray-400 tabular-nums">
                        {log.ip}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing last <span className="font-semibold text-gray-600">{mockLogs.length}</span> events
            </p>
            <button className="btn-ghost text-xs py-1 px-2" aria-label="Export audit log as CSV">
              Export CSV
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
