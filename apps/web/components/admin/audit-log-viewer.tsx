"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AuditLog } from "@logiqo/shared";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    year:    "numeric",
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
    second:  "2-digit",
    hour12:  false,
  });
}

const ACTION_COLORS: Record<string, string> = {
  device:       "bg-brand-50 text-brand-700 ring-brand-200",
  alert:        "bg-amber-50 text-amber-700 ring-amber-200",
  document:     "bg-violet-50 text-violet-700 ring-violet-200",
  admin:        "bg-rose-50 text-rose-700 ring-rose-200",
  annotation:   "bg-teal-50 text-teal-700 ring-teal-200",
  annotations:  "bg-teal-50 text-teal-700 ring-teal-200",
  org:          "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

function ActionBadge({ action }: { action: string }) {
  const [domain, ...rest] = action.split(".");
  const verb = rest.join(".");
  const cls = ACTION_COLORS[domain] ?? "bg-gray-100 text-gray-600 ring-gray-200";
  return (
    <span className={`badge ring-1 ring-inset ${cls} font-mono tracking-normal`}>
      {domain}
      {verb && <span className="opacity-50">.</span>}
      {verb}
    </span>
  );
}

const PAGE_SIZE = 50;

// ── Filter bar ─────────────────────────────────────────────────────────────────

interface Filters {
  action:       string;
  resourceType: string;
  startDate:    string;
  endDate:      string;
}

function FilterBar({
  value,
  onApply,
}: {
  value:   Filters;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Filters>(value);

  const handleApply = () => onApply(draft);

  const handleReset = () => {
    const empty = { action: "", resourceType: "", startDate: "", endDate: "" };
    setDraft(empty);
    onApply(empty);
  };

  const hasFilters = Object.values(value).some(Boolean);

  return (
    <div className="card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="al-action">Action</label>
          <input
            id="al-action"
            type="text"
            placeholder="e.g. device.approved"
            className="input"
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
        </div>

        <div>
          <label className="label" htmlFor="al-resource">Resource type</label>
          <input
            id="al-resource"
            type="text"
            placeholder="e.g. device, alert"
            className="input"
            value={draft.resourceType}
            onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
        </div>

        <div>
          <label className="label" htmlFor="al-from">From date</label>
          <input
            id="al-from"
            type="date"
            className="input"
            value={draft.startDate}
            onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
          />
        </div>

        <div>
          <label className="label" htmlFor="al-to">To date</label>
          <input
            id="al-to"
            type="date"
            className="input"
            value={draft.endDate}
            onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={handleApply} className="btn-primary text-xs px-3 py-1.5">
          Apply filters
        </button>
        {hasFilters && (
          <button onClick={handleReset} className="btn-ghost text-xs px-3 py-1.5">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Row detail expander ────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = log.oldValues || log.newValues || log.userAgent;

  return (
    <>
      <tr
        className={hasDetail ? "cursor-pointer select-none" : ""}
        onClick={() => hasDetail && setExpanded((e) => !e)}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <td>
          <time dateTime={log.createdAt} className="font-mono text-xs text-gray-500 whitespace-nowrap tabular-nums">
            {formatTimestamp(log.createdAt)}
          </time>
        </td>
        <td>
          <div className="text-sm text-gray-700 whitespace-nowrap">{log.userEmail ?? log.userId ?? "—"}</div>
          {log.userRole && (
            <div className="text-2xs text-gray-400 mt-0.5">{log.userRole}</div>
          )}
        </td>
        <td><ActionBadge action={log.action} /></td>
        <td>
          <code className="font-mono text-xs text-gray-600 bg-surface-muted px-1.5 py-0.5 rounded">
            {log.resourceType}
            {log.resourceId ? `:${log.resourceId.slice(0, 8)}…` : ""}
          </code>
        </td>
        <td>
          {log.responseStatus && (
            <span
              className={`font-mono text-xs font-semibold ${
                log.responseStatus < 400
                  ? "text-emerald-600"
                  : log.responseStatus < 500
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {log.responseStatus}
            </span>
          )}
        </td>
        <td>
          <code className="font-mono text-xs text-gray-400 tabular-nums">{log.ipAddress ?? "—"}</code>
        </td>
        {hasDetail && (
          <td>
            <svg
              aria-hidden="true"
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </td>
        )}
        {!hasDetail && <td />}
      </tr>

      {expanded && (
        <tr className="bg-surface-subtle">
          <td colSpan={7} className="px-4 pb-4 pt-1">
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              {log.oldValues && (
                <div>
                  <p className="font-semibold text-gray-500 mb-1">Old values</p>
                  <pre className="rounded bg-white border border-gray-200 p-2 overflow-x-auto text-gray-700 text-2xs leading-relaxed">
                    {JSON.stringify(log.oldValues, null, 2)}
                  </pre>
                </div>
              )}
              {log.newValues && (
                <div>
                  <p className="font-semibold text-gray-500 mb-1">New values</p>
                  <pre className="rounded bg-white border border-gray-200 p-2 overflow-x-auto text-gray-700 text-2xs leading-relaxed">
                    {JSON.stringify(log.newValues, null, 2)}
                  </pre>
                </div>
              )}
              {log.userAgent && (
                <div className="sm:col-span-2">
                  <p className="font-semibold text-gray-500 mb-1">User agent</p>
                  <p className="text-gray-500 break-all">{log.userAgent}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    action: "", resourceType: "", startDate: "", endDate: "",
  });

  const queryParams = {
    page,
    limit: PAGE_SIZE,
    ...(filters.action       ? { action:       filters.action       } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.startDate    ? { startDate:    `${filters.startDate}T00:00:00.000Z` } : {}),
    ...(filters.endDate      ? { endDate:      `${filters.endDate}T23:59:59.999Z`   } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn:  () => apiClient.admin.auditLogs(queryParams),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

  const logs       = data?.data    ?? [];
  const total      = data?.total   ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFiltersApply = useCallback((f: Filters) => {
    setFilters(f);
    setPage(1);
  }, []);

  const handleExport = () => {
    const url = apiClient.admin.auditLogsExportUrl({
      ...(filters.action       ? { action:       filters.action       } : {}),
      ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
      ...(filters.startDate    ? { startDate:    `${filters.startDate}T00:00:00.000Z` } : {}),
      ...(filters.endDate      ? { endDate:      `${filters.endDate}T23:59:59.999Z`   } : {}),
    });
    window.location.href = url;
  };

  return (
    <div className="space-y-4">
      <FilterBar value={filters} onApply={handleFiltersApply} />

      <div className="card overflow-hidden">
        {/* Loading overlay */}
        {(isLoading || isFetching) && (
          <div className="h-1 bg-brand-600 animate-pulse" aria-hidden="true" />
        )}

        {logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table" aria-label="Compliance audit log">
                <caption className="sr-only">Immutable audit log of all platform actions</caption>
                <thead>
                  <tr>
                    <th scope="col">Timestamp</th>
                    <th scope="col">User</th>
                    <th scope="col">Action</th>
                    <th scope="col">Resource</th>
                    <th scope="col">Status</th>
                    <th scope="col">IP</th>
                    <th scope="col" aria-label="Expand row" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400 tabular-nums">
                {total.toLocaleString()} event{total !== 1 ? "s" : ""} total
                {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="btn-ghost text-xs px-3 py-1.5"
                  title="Export current filters as CSV (up to 100k rows)"
                >
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export CSV
                </button>

                {totalPages > 1 && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            {isLoading ? "Loading audit log…" : "No events match the current filters"}
          </div>
        )}
      </div>
    </div>
  );
}
