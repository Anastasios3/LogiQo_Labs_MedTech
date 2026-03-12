"use client";

/**
 * DeviceAnnotationFeed — per-device TanStack Query infinite-scroll annotation feed.
 *
 * Features:
 *   - Initial SSR annotations shown immediately (via initialAnnotations prop)
 *   - TanStack Query useInfiniteQuery takes over; filters/sort changes re-fetch
 *   - IntersectionObserver sentinel triggers next page as user scrolls
 *   - Severity filter chips + sort selector (newest / top / discussed)
 *   - EndorseButton — optimistic thumbs-up toggle
 *   - FlagButton — inline popover with 4 reason options + optional notes
 *   - Expandable body: first 500 chars + "Read more" toggle
 *   - VoteButtons — up/down vote with optimistic UI
 *   - TierBadge — verification tier indicator for authors
 */

import { useState, useEffect, useRef, useTransition } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast }             from "@/components/ui/toast";
import type { Annotation, AnnotationSeverity, FlagReason } from "@logiqo/shared";

const PAGE_SIZE = 10;

// ── Config ────────────────────────────────────────────────────────────────────

const ANNOTATION_TYPE_LABELS: Record<string, string> = {
  operational_friction: "Operational Friction",
  failure_mode:         "Failure Mode",
  material_tolerance:   "Material Tolerance",
  tooling_anomaly:      "Tooling Anomaly",
  general_observation:  "General Observation",
};

const SEVERITY_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  critical: { dot: "bg-red-500",     badge: "badge-critical", label: "Critical" },
  high:     { dot: "bg-orange-500",  badge: "badge-high",     label: "High"     },
  medium:   { dot: "bg-amber-400",   badge: "badge-medium",   label: "Medium"   },
  low:      { dot: "bg-emerald-500", badge: "badge-low",      label: "Low"      },
};

const FLAG_REASONS: { value: FlagReason; label: string; description: string }[] = [
  {
    value:       "dangerous",
    label:       "Dangerous",
    description: "Content that could harm patients or procedures",
  },
  {
    value:       "inaccurate",
    label:       "Inaccurate",
    description: "Factually incorrect or misleading clinical data",
  },
  {
    value:       "spam",
    label:       "Spam",
    description: "Irrelevant or promotional content",
  },
  {
    value:       "conflict_of_interest",
    label:       "Conflict of Interest",
    description: "Undisclosed industry affiliation",
  },
];

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest"    },
  { value: "top",       label: "Top Rated" },
  { value: "discussed", label: "Discussed" },
] as const;

type SortOption = typeof SORT_OPTIONS[number]["value"];

// ── TierBadge ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: number }) {
  if (tier >= 3) {
    return (
      <span
        className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-2xs font-semibold text-violet-700"
        title="Trusted Contributor — manually reviewed by admin"
      >
        ✓✓ Trusted
      </span>
    );
  }
  if (tier === 2) {
    return (
      <span
        className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-2xs font-semibold text-emerald-700"
        title="NPI Verified Clinician"
      >
        ✓ Verified
      </span>
    );
  }
  return null;
}

// ── VoteButtons ───────────────────────────────────────────────────────────────

function VoteButtons({ annotation }: { annotation: Annotation }) {
  const [score, setScore] = useState(annotation.voteScore ?? 0);
  const [vote,  setVote]  = useState<-1 | 0 | 1>(annotation.userVote ?? 0);
  const [, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function handleVote(value: -1 | 1) {
    const prevScore = score;
    const prevVote  = vote;
    const removing  = vote === value;

    // Optimistic
    if (removing) {
      setVote(0);
      setScore(s => s - value);
    } else {
      if (vote !== 0) setScore(s => s - vote + value);
      else            setScore(s => s + value);
      setVote(value);
    }

    startTransition(async () => {
      try {
        if (removing) {
          await apiClient.annotations.removeVote(annotation.id);
        } else {
          const res = await apiClient.annotations.castVote(annotation.id, value);
          setScore(res.voteScore);
        }
        queryClient.invalidateQueries({ queryKey: ["device-annotations", annotation.deviceId] });
      } catch {
        setScore(prevScore);
        setVote(prevVote);
      }
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Upvote"
        onClick={() => handleVote(1)}
        className={`rounded p-1 transition-colors ${
          vote === 1
            ? "bg-indigo-50 text-indigo-600"
            : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-500"
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          fill={vote === 1 ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
        </svg>
      </button>

      <span
        className={`w-6 text-center text-xs font-semibold tabular-nums ${
          score > 0 ? "text-indigo-600" : score < 0 ? "text-red-500" : "text-gray-400"
        }`}
      >
        {score}
      </span>

      <button
        type="button"
        aria-label="Downvote"
        onClick={() => handleVote(-1)}
        className={`rounded p-1 transition-colors ${
          vote === -1
            ? "bg-red-50 text-red-500"
            : "text-gray-400 hover:bg-red-50 hover:text-red-400"
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          fill={vote === -1 ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
        </svg>
      </button>
    </div>
  );
}

// ── EndorseButton ─────────────────────────────────────────────────────────────

function EndorseButton({ annotation }: { annotation: Annotation }) {
  const [endorsed, setEndorsed] = useState(annotation.userHasEndorsed ?? false);
  const [count,    setCount]    = useState(annotation.endorsementCount ?? 0);
  const [busy,     setBusy]     = useState(false);
  const toast         = useToast();
  const queryClient   = useQueryClient();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const prev = { endorsed, count };
    setEndorsed(e => !e);
    setCount(c => prev.endorsed ? c - 1 : c + 1);
    try {
      if (prev.endorsed) {
        await apiClient.annotations.unendorse(annotation.id);
      } else {
        const res = await apiClient.annotations.endorse(annotation.id);
        setCount(res.endorsementCount);
      }
      queryClient.invalidateQueries({ queryKey: ["device-annotations", annotation.deviceId] });
    } catch {
      setEndorsed(prev.endorsed);
      setCount(prev.count);
      toast.error("Endorsement failed", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={endorsed ? "Remove endorsement" : "Endorse this annotation"}
      aria-pressed={endorsed}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        endorsed
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      <svg
        className="h-3.5 w-3.5"
        fill={endorsed ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z"
        />
      </svg>
      {count > 0 ? count : "Endorse"}
    </button>
  );
}

// ── FlagButton (inline popover) ───────────────────────────────────────────────

function FlagButton({ annotationId }: { annotationId: string }) {
  const [open,           setOpen]           = useState(false);
  const [reason,         setReason]         = useState<FlagReason | "">("");
  const [notes,          setNotes]          = useState("");
  const [busy,           setBusy]           = useState(false);
  const [done,           setDone]           = useState(false);
  /** Set true when the API returns 409 — user already has an open flag. */
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function resetPopover() {
    setOpen(false);
    setDone(false);
    setAlreadyFlagged(false);
    setReason("");
    setNotes("");
  }

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await apiClient.annotations.flag(annotationId, { reason, notes: notes || undefined });
      setDone(true);
      toast.info("Flag submitted", "A moderator will review this annotation.");
      setTimeout(resetPopover, 1800);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Backend unique constraint: (annotationId, userId) — user already has an
        // open unresolved flag on this annotation. Show an inline message instead
        // of a generic failure toast so the user understands no action is needed.
        setAlreadyFlagged(true);
        setTimeout(resetPopover, 2200);
      } else {
        toast.error("Flag failed", "Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Flag this annotation"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
        Flag
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Flag annotation"
          className="absolute right-0 top-9 z-30 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl ring-1 ring-black/5"
        >
          {done ? (
            <div className="flex items-center gap-2 py-2 text-sm text-emerald-600">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Flag submitted — thank you.
            </div>
          ) : alreadyFlagged ? (
            // 409 — unique constraint (annotationId, userId): user already has an open flag.
            // Show a calm informational message; no action is needed from the user.
            <div className="flex items-start gap-2 py-2 text-sm text-amber-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              You have already flagged this annotation. A moderator will review it shortly.
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Select reason</p>
              <div className="space-y-2">
                {FLAG_REASONS.map(r => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                      reason === r.value
                        ? "border-red-300 bg-red-50"
                        : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`flag-reason-${annotationId}`}
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="mt-0.5 accent-red-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                      <p className="text-2xs text-gray-400">{r.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional context (optional)…"
                rows={2}
                className="mt-3 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!reason || busy}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-40"
                >
                  {busy ? "Submitting…" : "Submit flag"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── AnnotationCard ────────────────────────────────────────────────────────────

const BODY_PREVIEW_LENGTH = 500;

function AnnotationCard({ annotation }: { annotation: Annotation }) {
  const [expanded, setExpanded] = useState(false);
  const isLong     = annotation.body.length > BODY_PREVIEW_LENGTH;
  const displayBody = isLong && !expanded
    ? `${annotation.body.slice(0, BODY_PREVIEW_LENGTH)}…`
    : annotation.body;

  const sev = annotation.severity ? SEVERITY_CONFIG[annotation.severity] : null;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-info text-xs">
            {ANNOTATION_TYPE_LABELS[annotation.annotationType] ?? annotation.annotationType}
          </span>
          {sev && (
            <span className={`badge ${sev.badge}`}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
              {sev.label}
            </span>
          )}
          {annotation.status === "flagged" && (
            <span className="badge badge-recalled text-xs">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Flagged ({annotation.flagCount})
            </span>
          )}
        </div>
        <time
          className="whitespace-nowrap text-xs text-gray-400"
          dateTime={annotation.createdAt}
        >
          {new Date(annotation.createdAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </time>
      </div>

      {/* ── Body ── */}
      <h3 className="mt-3 text-sm font-semibold leading-snug text-gray-900">
        {annotation.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
        {displayBody}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-1.5 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {/* ── Procedure metadata ── */}
      {(annotation.procedureType || annotation.procedureDate || annotation.patientCount) && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          {annotation.procedureType && (
            <span>
              Procedure:{" "}
              <strong className="text-gray-700">{annotation.procedureType}</strong>
            </span>
          )}
          {annotation.procedureDate && (
            <span>
              Date:{" "}
              <strong className="text-gray-700">{annotation.procedureDate}</strong>
            </span>
          )}
          {annotation.patientCount != null && (
            <span>
              Patients:{" "}
              <strong className="text-gray-700">{annotation.patientCount}</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Author ── */}
      {annotation.author && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700" aria-hidden="true">
            {annotation.author.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-gray-800">
                {annotation.author.fullName}
              </span>
              <TierBadge tier={annotation.author.verificationTier} />
            </div>
            {annotation.author.specialty && (
              <p className="text-2xs text-gray-400">{annotation.author.specialty}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Action row ── */}
      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
        <VoteButtons annotation={annotation} />
        <div className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
        <EndorseButton annotation={annotation} />
        <div className="flex-1" />
        <FlagButton annotationId={annotation.id} />
      </div>
    </article>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AnnotationSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-5"
      role="status"
      aria-label="Loading annotation"
    >
      <div className="flex gap-2">
        <div className="h-5 w-32 animate-pulse rounded-full bg-gray-100" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
      </div>
      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
      <div className="space-y-1.5">
        <div className="h-3 w-full  animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-5/6  animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-4/6  animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-3 w-36 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

interface FilterBarProps {
  sort:       SortOption;
  severity:   AnnotationSeverity | "";
  onSort:     (v: SortOption) => void;
  onSeverity: (v: AnnotationSeverity | "") => void;
  total:      number;
  isFetching: boolean;
}

function FilterBar({
  sort,
  severity,
  onSort,
  onSeverity,
  total,
  isFetching,
}: FilterBarProps) {
  const chips: { value: AnnotationSeverity | ""; label: string }[] = [
    { value: "",         label: "All"      },
    { value: "critical", label: "Critical" },
    { value: "high",     label: "High"     },
    { value: "medium",   label: "Medium"   },
    { value: "low",      label: "Low"      },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      {/* Severity chips */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
        {chips.map(chip => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onSeverity(chip.value)}
            aria-pressed={severity === chip.value}
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              severity === chip.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            ].join(" ")}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Background-refresh indicator */}
      {isFetching && (
        <div className="flex items-center gap-1 text-xs text-indigo-500">
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Refreshing…
        </div>
      )}

      {/* Total */}
      <span className="text-xs text-gray-400">
        {total} annotation{total !== 1 ? "s" : ""}
      </span>

      {/* Sort selector */}
      <select
        value={sort}
        onChange={e => onSort(e.target.value as SortOption)}
        aria-label="Sort annotations"
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── DeviceAnnotationFeed (exported) ──────────────────────────────────────────

export interface DeviceAnnotationFeedProps {
  deviceId:           string;
  initialAnnotations: Annotation[];
  initialTotal:       number;
}

export function DeviceAnnotationFeed({
  deviceId,
  initialAnnotations,
  initialTotal,
}: DeviceAnnotationFeedProps) {
  const [sort,     setSort]     = useState<SortOption>("newest");
  const [severity, setSeverity] = useState<AnnotationSeverity | "">("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey:         ["device-annotations", deviceId, { sort, severity }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.annotations.list({
        deviceId,
        sort,
        severity: severity || undefined,
        page:     pageParam as number,
        limit:    PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap(p => p.data).length;
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    // Hydrate first page with SSR data for the default (newest, no-filter) view
    // so annotations appear instantly without a loading skeleton on first render.
    initialData:
      sort === "newest" && !severity
        ? {
            pages:      [{ data: initialAnnotations, total: initialTotal, page: 1, limit: PAGE_SIZE }],
            pageParams: [1],
          }
        : undefined,
  });

  // Infinite scroll — load next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const annotations = data?.pages.flatMap(p => p.data) ?? initialAnnotations;
  const total       = data?.pages[0]?.total ?? initialTotal;

  // ── Error state ────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        Could not load annotations — API unavailable
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <FilterBar
        sort={sort}
        severity={severity}
        onSort={v => { setSort(v); }}
        onSeverity={v => { setSeverity(v); }}
        total={total}
        isFetching={isFetching && !isLoading}
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading annotations">
          {[1, 2, 3].map(i => <AnnotationSkeleton key={i} />)}
        </div>
      ) : annotations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
            <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            {severity
              ? `No ${severity}-severity annotations for this device`
              : "No peer annotations for this device yet"}
          </p>
          <a
            href={`/dashboard/annotations/new?deviceId=${deviceId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            Submit first annotation
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {annotations.map(ann => (
              <AnnotationCard key={ann.id} annotation={ann} />
            ))}
          </div>

          {/* Infinite scroll sentinel — IntersectionObserver watches this */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />

          {isFetchingNextPage && (
            <div className="space-y-4 pt-2" aria-label="Loading more annotations">
              <AnnotationSkeleton />
              <AnnotationSkeleton />
            </div>
          )}

          {!hasNextPage && annotations.length > 0 && (
            <p className="pt-4 text-center text-xs text-gray-400">
              All {total} annotation{total !== 1 ? "s" : ""} loaded
            </p>
          )}
        </>
      )}
    </div>
  );
}
