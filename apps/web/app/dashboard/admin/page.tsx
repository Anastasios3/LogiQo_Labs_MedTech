import { apiClient } from "@/lib/api-client";
import type { Device, AuditLog } from "@logiqo/shared";
import type { AdminStats } from "@/lib/api-client";

export const metadata = {
  title: "Admin Dashboard | LogiQo MedTech",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
    hour12:  false,
  });
}

// Action badge — colour-codes event types for fast scanning
// (Refactoring UI: use color intentionally to communicate meaning)
function ActionBadge({ action }: { action: string }) {
  const [domain, verb] = action.split(".");
  const colors: Record<string, string> = {
    device:       "bg-brand-50 text-brand-700 ring-brand-200",
    alert:        "bg-amber-50 text-amber-700 ring-amber-200",
    document:     "bg-violet-50 text-violet-700 ring-violet-200",
    admin:        "bg-rose-50 text-rose-700 ring-rose-200",
    annotation:   "bg-teal-50 text-teal-700 ring-teal-200",
    annotations:  "bg-teal-50 text-teal-700 ring-teal-200",
    devices:      "bg-brand-50 text-brand-700 ring-brand-200",
  };
  const cls = colors[domain] ?? "bg-gray-100 text-gray-600 ring-gray-200";

  return (
    <span className={`badge ring-1 ring-inset ${cls} font-mono tracking-normal`}>
      {domain}
      <span className="text-current opacity-50">.</span>
      {verb ?? ""}
    </span>
  );
}

// Stat card
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AdminPage() {
  // Fetch all data in parallel — graceful fallback on API unavailable
  const [statsResult, pendingResult, logsResult] = await Promise.allSettled([
    apiClient.admin.stats(),
    apiClient.admin.pendingDevices({ limit: 20 }),
    apiClient.admin.auditLogs({ limit: 50 }),
  ]);

  const stats: AdminStats = statsResult.status === "fulfilled"
    ? statsResult.value
    : { pendingDevices: 0, auditEventsToday: 0, activeDevices: 0, activeAlerts: 0 };

  const pendingDevices: Device[] = pendingResult.status === "fulfilled"
    ? pendingResult.value.data
    : [];

  const auditLogs: AuditLog[] = logsResult.status === "fulfilled"
    ? logsResult.value.data
    : [];

  const apiDown = statsResult.status === "rejected";

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

      {/* API unavailable notice */}
      {apiDown && (
        <div className="preview-banner">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          API not reachable — start the API server and run migrations to load live data
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Pending Approvals"
          value={stats.pendingDevices}
          sub="Awaiting review"
          accent={stats.pendingDevices > 0 ? "border-amber-200" : ""}
        />
        <StatCard
          label="Audit Events Today"
          value={stats.auditEventsToday}
          sub="Last 24 h"
        />
        <StatCard
          label="Active Devices"
          value={stats.activeDevices}
          sub="In index"
        />
        <StatCard
          label="Active Alerts"
          value={stats.activeAlerts}
          sub="Unacknowledged"
          accent={stats.activeAlerts > 0 ? "border-orange-200" : ""}
        />
      </div>

      {/* ── Pending Approvals ──────────────────────────────────────────────── */}
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-4">
          Pending Device Approvals
        </h2>

        <div className="card overflow-hidden">
          {pendingDevices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table" aria-label="Devices awaiting approval">
                <caption className="sr-only">
                  Devices submitted for review, awaiting safety officer approval
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Device</th>
                    <th scope="col">Manufacturer</th>
                    <th scope="col">Category</th>
                    <th scope="col">Submitted</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDevices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <p className="font-semibold text-gray-900">{device.name}</p>
                        <p className="font-mono text-2xs text-gray-400 mt-0.5">{device.sku}</p>
                      </td>
                      <td className="text-gray-700">{device.manufacturer?.name ?? "—"}</td>
                      <td className="text-gray-600">{device.category?.name ?? "—"}</td>
                      <td>
                        <time className="text-sm text-gray-500" dateTime={device.createdAt}>
                          {new Date(device.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </time>
                      </td>
                      <td>
                        {/* Action buttons — Inclusive Components: descriptive labels */}
                        <div className="flex items-center justify-end gap-2">
                          <form action={`/api/admin/devices/${device.id}/approve`} method="post">
                            <button
                              type="submit"
                              className="btn-primary text-xs px-3 py-1.5"
                              aria-label={`Approve ${device.name}`}
                            >
                              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Approve
                            </button>
                          </form>
                          <form action={`/api/admin/devices/${device.id}/reject`} method="post">
                            <button
                              type="submit"
                              className="btn-danger text-xs px-3 py-1.5"
                              aria-label={`Reject ${device.name}`}
                            >
                              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {apiDown ? "API unavailable — cannot load pending approvals" : "No pending approvals — all caught up!"}
            </div>
          )}
        </div>
      </section>

      {/* ── Audit Log ──────────────────────────────────────────────────────── */}
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
          {auditLogs.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="data-table" aria-label="Immutable compliance audit log">
                  <caption className="sr-only">
                    Immutable audit log of all user actions
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
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <time
                            dateTime={log.createdAt}
                            className="font-mono text-xs text-gray-500 whitespace-nowrap tabular-nums"
                          >
                            {formatTimestamp(log.createdAt)}
                          </time>
                        </td>
                        <td>
                          <span className="text-sm text-gray-700">
                            {log.userEmail ?? log.userId ?? "—"}
                          </span>
                        </td>
                        <td>
                          <ActionBadge action={log.action} />
                        </td>
                        <td>
                          <code className="font-mono text-xs text-gray-600 bg-surface-muted px-1.5 py-0.5 rounded">
                            {log.resourceType}
                            {log.resourceId ? `:${log.resourceId.slice(0, 8)}…` : ""}
                          </code>
                        </td>
                        <td>
                          <code className="font-mono text-xs text-gray-400 tabular-nums">
                            {log.ipAddress ?? "—"}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing last <span className="font-semibold text-gray-600">{auditLogs.length}</span> events
                </p>
                <button className="btn-ghost text-xs py-1 px-2" aria-label="Export audit log as CSV">
                  Export CSV
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
              {apiDown ? "API unavailable — cannot load audit log" : "No audit events yet"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
