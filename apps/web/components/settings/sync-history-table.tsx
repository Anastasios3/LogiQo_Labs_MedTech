"use client";

import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { IngestionRun } from "@logiqo/shared";

// ── Helpers ────────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  fdaRecalls: "FDA Recalls",
  fda510k:    "FDA 510(k)",
  gudid:      "GUDID",
  eudamed:    "EUDAMED",
  cron:       "Cron",
};

const STATUS_STYLES: Record<string, string> = {
  running:   "badge badge-warning",
  completed: "badge badge-success",
  failed:    "badge badge-danger",
};

function formatDuration(start: Date | string, end: Date | string | null | undefined): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function formatTs(ts: Date | string): string {
  return new Date(ts).toLocaleString(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  initialRuns:  IngestionRun[];
  initialTotal: number;
}

export function SyncHistoryTable({ initialRuns, initialTotal }: Props) {
  const [runs,    setRuns]    = useState<IngestionRun[]>(initialRuns);
  const [total,   setTotal]   = useState(initialTotal);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [source,  setSource]  = useState<string>("");

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRuns = useCallback(async (nextPage: number, src: string) => {
    setLoading(true);
    try {
      const res = await apiClient.ingestion.runs({
        page:   nextPage,
        limit:  LIMIT,
        source: src || undefined,
      });
      setRuns(res.data);
      setTotal(res.total);
      setPage(nextPage);
    } catch {
      // keep current data
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSourceChange(val: string) {
    setSource(val);
    fetchRuns(1, val);
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Sync History</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Recent ingestion runs — {total} total
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Source filter */}
          <select
            value={source}
            onChange={e => handleSourceChange(e.target.value)}
            className="input py-1.5 text-sm"
            style={{ minWidth: "10rem" }}
          >
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => fetchRuns(page, source)}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            {loading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      {runs.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">No sync runs yet</p>
          <p className="text-xs text-gray-400 mt-1">Trigger a sync from the panel above to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ingested</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Skipped</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Triggered by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {SOURCE_LABELS[run.source] ?? run.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={STATUS_STYLES[run.status] ?? "badge"}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm tabular-nums text-gray-900">{run.recordsIngested}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm tabular-nums text-gray-500">{run.recordsSkipped}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-500 tabular-nums">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-500">{formatTs(run.startedAt)}</span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={[
                      "inline-flex items-center rounded-full px-2 py-0.5",
                      "text-2xs font-medium",
                      run.triggeredBy === "cron"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700",
                    ].join(" ")}>
                      {run.triggeredBy === "cron" ? "Scheduler" : "Manual"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages} — {total} total runs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRuns(page - 1, source)}
              disabled={page <= 1 || loading}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              onClick={() => fetchRuns(page + 1, source)}
              disabled={page >= totalPages || loading}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
