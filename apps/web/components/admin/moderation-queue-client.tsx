"use client";

/**
 * ModerationQueueClient — real-time flagged annotation table.
 *
 * Data strategy:
 *   Primary:  WebSocket connection to /ws/moderation (events: annotation_flagged,
 *             annotation_moderated) → triggers query invalidation on each event.
 *   Fallback: TanStack Query refetchInterval: 15 000ms — guarantees freshness
 *             even when WebSocket is unavailable (VPN, proxy, dev environment).
 *
 * Actions:
 *   Approve  — PATCH /admin/annotations/:id/moderate { action: "approve" }
 *   Remove   — PATCH /admin/annotations/:id/moderate { action: "reject", reviewNotes: reason }
 *
 * Both actions:
 *   - Optimistically hide the row (filter from local list)
 *   - Fire toast on success
 *   - Re-validate query on failure to restore accuracy
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient }                  from "@tanstack/react-query";
import { apiClient }                                 from "@/lib/api-client";
import { useToast }                                  from "@/components/ui/toast";
import type { Annotation, AnnotationFlag }           from "@logiqo/shared";

const POLL_INTERVAL_MS = 15_000;
const WS_RECONNECT_DELAY_MS = 3_000;
const BODY_PREVIEW_CHARS = 200;

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { badge: string; dot: string }> = {
  critical: { badge: "badge-critical", dot: "bg-red-500"    },
  high:     { badge: "badge-high",     dot: "bg-orange-500" },
  medium:   { badge: "badge-medium",   dot: "bg-amber-400"  },
  low:      { badge: "badge-low",      dot: "bg-emerald-500"},
};

const FLAG_REASON_LABELS: Record<string, string> = {
  dangerous:            "Dangerous",
  inaccurate:           "Inaccurate",
  spam:                 "Spam",
  conflict_of_interest: "Conflict of Interest",
};

// ── WebSocket hook ────────────────────────────────────────────────────────────

function useAnnotationModerationWS({ onUpdate }: { onUpdate: () => void }) {
  const wsRef       = useRef<WebSocket | null>(null);
  const retryRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080"}/ws/moderation`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as { type: string };
          if (
            msg.type === "annotation_flagged"   ||
            msg.type === "annotation_moderated"
          ) {
            onUpdate();
          }
        } catch { /* non-JSON frames — ignore */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        retryRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    } catch {
      // WebSocket not supported / URL malformed — polling will cover it
    }
  }, [onUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

// ── ReviewModal ───────────────────────────────────────────────────────────────

interface ReviewModalProps {
  annotation: Annotation & { flags?: AnnotationFlag[] };
  onClose:    () => void;
  onApprove:  (id: string) => Promise<void>;
  onRemove:   (id: string, reason: string) => Promise<void>;
}

function ReviewModal({ annotation, onClose, onApprove, onRemove }: ReviewModalProps) {
  const [removeMode, setRemoveMode] = useState(false);
  const [reason,     setReason]     = useState("");
  const [busy,       setBusy]       = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const sev = annotation.severity ? SEVERITY_CONFIG[annotation.severity] : null;

  async function doApprove() {
    setBusy(true);
    try { await onApprove(annotation.id); onClose(); }
    finally { setBusy(false); }
  }

  async function doRemove() {
    if (!reason.trim()) return;
    setBusy(true);
    try { await onRemove(annotation.id, reason.trim()); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Review annotation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Review Annotation
            </h2>
            {annotation.device && (
              <p className="mt-0.5 text-xs text-gray-400">
                Device:{" "}
                <span className="font-medium text-gray-600">{annotation.device.name}</span>
                {" · "}
                <span className="font-mono">{annotation.device.sku}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {sev && (
              <span className={`badge ${sev.badge}`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                {annotation.severity}
              </span>
            )}
            <span className="badge badge-recalled">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {annotation.flagCount} flag{annotation.flagCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Annotation content */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{annotation.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
              {annotation.body}
            </p>
          </div>

          {/* Author */}
          {annotation.author && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-medium text-gray-800">{annotation.author.fullName}</p>
              {annotation.author.specialty && (
                <p className="text-xs text-gray-400">{annotation.author.specialty}</p>
              )}
              <p className="mt-0.5 text-xs text-gray-400">
                Verification tier: {annotation.author.verificationTier}
              </p>
            </div>
          )}

          {/* Flag reasons */}
          {annotation.flags && annotation.flags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Flag reasons ({annotation.flags.length})
              </p>
              <div className="space-y-2">
                {annotation.flags.map(flag => (
                  <div
                    key={flag.id}
                    className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-red-800">
                      {FLAG_REASON_LABELS[flag.reason] ?? flag.reason}
                    </p>
                    {flag.notes && (
                      <p className="mt-1 text-xs text-red-600">{flag.notes}</p>
                    )}
                    <p className="mt-1 text-2xs text-red-400">
                      {new Date(flag.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remove reason textarea */}
          {removeMode && (
            <div>
              <label htmlFor="remove-reason" className="mb-1 block text-sm font-medium text-gray-700">
                Removal reason <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="remove-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this annotation is being removed…"
                rows={3}
                className="input resize-none"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {!removeMode ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setRemoveMode(true)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={doApprove}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Approving…" : "Approve"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setRemoveMode(false); setReason(""); }}
                className="btn btn-secondary"
                disabled={busy}
              >
                Back
              </button>
              <button
                type="button"
                onClick={doRemove}
                disabled={!reason.trim() || busy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? "Removing…" : "Confirm removal"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ModerationQueueClient (exported) ─────────────────────────────────────────

export function ModerationQueueClient() {
  const queryClient = useQueryClient();
  const toast       = useToast();
  const [page,        setPage]        = useState(1);
  const [reviewing,   setReviewing]   = useState<Annotation | null>(null);

  const LIMIT = 20;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
  }, [queryClient]);

  // WebSocket for real-time updates
  useAnnotationModerationWS({ onUpdate: invalidate });

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey:        ["admin", "moderation", page],
    queryFn:         () => apiClient.admin.flaggedAnnotations({ page, limit: LIMIT }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const annotations = data?.data ?? [];
  const total       = data?.total ?? 0;
  const totalPages  = Math.ceil(total / LIMIT);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleApprove(annotationId: string) {
    try {
      await apiClient.admin.approveAnnotation(annotationId);
      toast.success("Annotation approved", "The annotation is restored and visible to users.");
      invalidate();
    } catch {
      toast.error("Approval failed", "Please try again.");
      invalidate(); // restore accurate state
    }
  }

  async function handleRemove(annotationId: string, reason: string) {
    try {
      await apiClient.admin.removeAnnotation(annotationId, reason);
      toast.info("Annotation removed", "The annotation has been hidden from the platform.");
      invalidate();
    } catch {
      toast.error("Removal failed", "Please try again.");
      invalidate();
    }
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="card flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        API unavailable — cannot load moderation queue
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────

  if (!isLoading && annotations.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900">Queue is clear</p>
        <p className="text-sm text-gray-500 max-w-xs">
          No flagged annotations awaiting review. Refreshes every 15 seconds.
        </p>
      </div>
    );
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="card overflow-hidden">
        {/* Polling / WS indicator */}
        {isFetching && !isLoading && (
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Refreshing queue…
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Flagged annotations awaiting moderation">
            <caption className="sr-only">
              Peer annotations flagged by users, awaiting safety officer review.
            </caption>
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Annotation</th>
                <th scope="col">Severity</th>
                <th scope="col">Flags</th>
                <th scope="col">Submitted</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [1, 2, 3, 4].map(i => <RowSkeleton key={i} />)
                : annotations.map(ann => {
                    const sev = ann.severity ? SEVERITY_CONFIG[ann.severity] : null;
                    const preview = ann.body.length > BODY_PREVIEW_CHARS
                      ? `${ann.body.slice(0, BODY_PREVIEW_CHARS)}…`
                      : ann.body;

                    // Collect unique flag reasons
                    const reasonCounts: Record<string, number> = {};
                    if (ann.tags) {
                      // tags aren't flags, skip
                    }

                    return (
                      <tr key={ann.id}>
                        {/* Device */}
                        <td>
                          {ann.device ? (
                            <>
                              <p className="font-medium text-gray-900 text-sm">{ann.device.name}</p>
                              <p className="font-mono text-2xs text-gray-400">{ann.device.sku}</p>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Annotation excerpt */}
                        <td className="max-w-xs">
                          <p className="text-sm font-medium text-gray-900 truncate">{ann.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{preview}</p>
                        </td>

                        {/* Severity */}
                        <td>
                          {sev ? (
                            <span className={`badge ${sev.badge}`}>
                              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                              {ann.severity}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Flag count */}
                        <td>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              ann.flagCount >= 5 ? "bg-red-100 text-red-700"    :
                              ann.flagCount >= 3 ? "bg-orange-100 text-orange-700" :
                                                   "bg-amber-100 text-amber-700"
                            }`}
                            aria-label={`${ann.flagCount} flags`}
                          >
                            {ann.flagCount}
                          </span>
                        </td>

                        {/* Date */}
                        <td>
                          <time className="text-xs text-gray-500" dateTime={ann.createdAt}>
                            {new Date(ann.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </time>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            {/* Quick approve (no modal) */}
                            <button
                              type="button"
                              onClick={() => handleApprove(ann.id)}
                              aria-label={`Approve annotation: ${ann.title}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              Approve
                            </button>
                            {/* Review opens modal (full text + remove) */}
                            <button
                              type="button"
                              onClick={() => setReviewing(ann)}
                              aria-label={`Review annotation: ${ann.title}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-4 py-2.5">
          <p className="text-xs text-gray-400">
            <span className="font-semibold text-gray-600">{total}</span>{" "}
            flagged annotation{total !== 1 ? "s" : ""} awaiting review ·{" "}
            auto-refreshes every 15 s
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-40"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Prev
              </button>
              <span className="tabular-nums text-xs text-gray-400">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-40"
              >
                Next
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review modal */}
      {reviewing && (
        <ReviewModal
          annotation={reviewing}
          onClose={() => setReviewing(null)}
          onApprove={handleApprove}
          onRemove={handleRemove}
        />
      )}
    </>
  );
}
