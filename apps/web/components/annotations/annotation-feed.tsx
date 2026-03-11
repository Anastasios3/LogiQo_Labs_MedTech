"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type { Annotation } from "@logiqo/shared";
import { apiClient } from "@/lib/api-client";

// ── Type / Severity config ────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { badge: string; label: string }> = {
  operational_friction: { badge: "badge-info",   label: "Operational Friction" },
  failure_mode:         { badge: "badge-high",   label: "Failure Mode"         },
  material_tolerance:   { badge: "badge-medium", label: "Material Tolerance"   },
  tooling_anomaly:      { badge: "badge-medium", label: "Tooling Anomaly"      },
  general_observation:  { badge: "badge-low",    label: "General Observation"  },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-600",
  high:     "bg-orange-500",
  medium:   "bg-amber-400",
  low:      "bg-emerald-500",
};

/** Verification tier badge */
function TierBadge({ tier }: { tier: number }) {
  if (tier < 2) return null;
  const label = tier === 3 ? "✓✓ Trusted" : "✓ Verified";
  const cls   = tier === 3
    ? "bg-violet-100 text-violet-700 border border-violet-200"
    : "bg-emerald-100 text-emerald-700 border border-emerald-200";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Vote Button ───────────────────────────────────────────────────────────────

function VoteButtons({
  annotationId,
  score,
  userVote: initialVote,
  onVoteChange,
}: {
  annotationId: string;
  score: number;
  userVote: number;
  onVoteChange?: (newScore: number, newVote: number) => void;
}) {
  const [vote,    setVote]    = useState(initialVote);
  const [display, setDisplay] = useState(score);
  const [isPending, startTransition] = useTransition();

  const handleVote = useCallback(async (value: 1 | -1) => {
    const newVote = vote === value ? 0 : value;

    // Optimistic update
    const delta = newVote - vote;
    setVote(newVote);
    setDisplay((p: number) => p + delta);
    onVoteChange?.(display + delta, newVote);

    startTransition(async () => {
      try {
        if (newVote === 0) {
          await apiClient.annotations.removeVote(annotationId);
        } else {
          await apiClient.annotations.castVote(annotationId, newVote as 1 | -1);
        }
      } catch {
        // Revert on error
        setVote(initialVote);
        setDisplay(score);
      }
    });
  }, [vote, display, annotationId, initialVote, score, onVoteChange]);

  return (
    <div className="flex items-center gap-1" aria-label={`Vote score: ${display}`}>
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        aria-pressed={vote === 1}
        aria-label="Upvote"
        className={`flex items-center justify-center rounded p-1 transition-colors ${
          vote === 1
            ? "bg-emerald-100 text-emerald-700"
            : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
        </svg>
      </button>

      <span className={`min-w-[1.5rem] text-center text-xs font-bold tabular-nums ${
        display > 0 ? "text-emerald-700" : display < 0 ? "text-red-600" : "text-gray-500"
      }`}>
        {display > 0 ? `+${display.toFixed(1)}` : display.toFixed(1)}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        aria-pressed={vote === -1}
        aria-label="Downvote"
        className={`flex items-center justify-center rounded p-1 transition-colors ${
          vote === -1
            ? "bg-red-100 text-red-700"
            : "text-gray-400 hover:text-red-600 hover:bg-red-50"
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
        </svg>
      </button>
    </div>
  );
}

// ── Tag Badge ─────────────────────────────────────────────────────────────────

function TagChip({ slug, name, category }: { slug: string; name: string; category: string }) {
  const colors: Record<string, string> = {
    material:    "bg-blue-50 text-blue-700 border-blue-200",
    specialty:   "bg-purple-50 text-purple-700 border-purple-200",
    procedure:   "bg-amber-50 text-amber-700 border-amber-200",
    device_type: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${colors[category] ?? colors.device_type}`}>
      {name}
    </span>
  );
}

// ── Inline Comments Panel ─────────────────────────────────────────────────────

function CommentsPanel({ annotationId, initialCount }: { annotationId: string; initialCount: number }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [body,    setBody]    = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    if (open) { setOpen(false); return; }
    setLoading(true);
    try {
      const data = await apiClient.annotations.listComments(annotationId);
      setComments(data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const postComment = async () => {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const comment = await apiClient.annotations.addComment(annotationId, { body });
      setComments(prev => [...prev, { ...comment, replies: [] }]);
      setBody("");
    } finally {
      setPosting(false);
    }
  };

  const count = open ? comments.length : initialCount;

  return (
    <div>
      <button
        onClick={load}
        disabled={loading}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
        aria-expanded={open}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        {loading ? "Loading…" : `${count} ${count === 1 ? "comment" : "comments"}`}
      </button>

      {open && (
        <div className="mt-3 ml-2 space-y-3 border-l-2 border-gray-100 pl-4">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400">No comments yet. Be the first.</p>
          )}

          {comments.map((c: any) => (
            <div key={c.id} className="space-y-2">
              <CommentItem comment={c} annotationId={annotationId} />
              {c.replies?.map((reply: any) => (
                <div key={reply.id} className="ml-4 border-l-2 border-gray-100 pl-4">
                  <CommentItem comment={reply} annotationId={annotationId} isReply />
                  {reply.replies?.map((nested: any) => (
                    <div key={nested.id} className="ml-4 border-l-2 border-gray-100 pl-4 mt-2">
                      <CommentItem comment={nested} annotationId={annotationId} isReply />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          {/* New comment input */}
          <div className="flex gap-2 pt-1">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Add a clinical comment…"
              rows={2}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"
            />
            <button
              onClick={postComment}
              disabled={posting || !body.trim()}
              className="self-end rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {posting ? "…" : "Post"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, annotationId, isReply = false }: { comment: any; annotationId: string; isReply?: boolean }) {
  const [vote,    setVote]    = useState(comment.userVote ?? 0);
  const [display, setDisplay] = useState(comment.voteScore ?? 0);

  const handleVote = async (value: 1 | -1) => {
    const newVote = vote === value ? 0 : value;
    const delta   = newVote - vote;
    setVote(newVote);
    setDisplay((p: number) => p + delta);
    try {
      if (newVote === 0) await apiClient.annotations.removeCommentVote(annotationId, comment.id);
      else await apiClient.annotations.castCommentVote(annotationId, comment.id, newVote as 1 | -1);
    } catch { setVote(comment.userVote ?? 0); setDisplay(comment.voteScore ?? 0); }
  };

  const initials = (comment.author?.fullName ?? "?")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex gap-2">
      <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-bold text-brand-700">
        {initials}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-2xs text-gray-500">
          <span className="font-medium text-gray-700">{comment.isAnonymized ? "Anonymous" : comment.author?.fullName}</span>
          {!comment.isAnonymized && <TierBadge tier={comment.author?.verificationTier ?? 0} />}
          <span>·</span>
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
        </div>
        <p className="mt-0.5 text-xs text-gray-700 leading-relaxed">{comment.body}</p>
        <div className="mt-1 flex items-center gap-2">
          <button onClick={() => handleVote(1)} aria-pressed={vote === 1} className={`text-2xs ${vote === 1 ? "text-emerald-700 font-semibold" : "text-gray-400 hover:text-emerald-600"}`}>▲</button>
          <span className={`text-2xs tabular-nums ${display > 0 ? "text-emerald-700" : display < 0 ? "text-red-600" : "text-gray-400"}`}>{display}</span>
          <button onClick={() => handleVote(-1)} aria-pressed={vote === -1} className={`text-2xs ${vote === -1 ? "text-red-700 font-semibold" : "text-gray-400 hover:text-red-600"}`}>▼</button>
        </div>
      </div>
    </div>
  );
}

// ── Sort / Filter Bar ─────────────────────────────────────────────────────────

function SortBar({
  sort, onSort,
}: {
  sort: "top" | "newest" | "discussed";
  onSort: (s: "top" | "newest" | "discussed") => void;
}) {
  const options: { key: "top" | "newest" | "discussed"; label: string }[] = [
    { key: "top",       label: "🔥 Top" },
    { key: "newest",    label: "🕐 Newest" },
    { key: "discussed", label: "💬 Most Discussed" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onSort(o.key)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            sort === o.key
              ? "bg-brand-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Annotation Card ───────────────────────────────────────────────────────────

function AnnotationCard({ ann }: { ann: Annotation & {
  voteScore?: number;
  userVote?: number;
  commentCount?: number;
  tags?: any[];
} }) {
  const typeConf = TYPE_CONFIG[ann.annotationType] ?? { badge: "badge-info", label: ann.annotationType };
  const dot      = SEVERITY_DOT[ann.severity ?? "low"] ?? "bg-gray-400";
  const score    = ann.voteScore ?? 0;
  const userVote = ann.userVote ?? 0;
  const commentCount = ann.commentCount ?? ann._count?.comments ?? 0;

  return (
    <article className="card overflow-hidden" aria-label={`${typeConf.label}: ${ann.title}`}>
      {/* Left score column */}
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-gray-100 bg-gray-50 px-2 py-4">
          <VoteButtons
            annotationId={ann.id}
            score={score}
            userVote={userVote}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 p-4">
          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={typeConf.badge}>{typeConf.label}</span>
            {ann.severity && (
              <span className="flex items-center gap-1 text-2xs text-gray-500">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {ann.severity.charAt(0).toUpperCase() + ann.severity.slice(1)}
              </span>
            )}
            <span className={ann.isPublished ? "badge-approved" : "badge-pending"}>
              {ann.isPublished ? "Published" : "Pending Review"}
            </span>
            {/* Tags */}
            {ann.tags?.slice(0, 4).map((tl: any) => (
              <TagChip
                key={tl.tagId}
                slug={tl.tag?.slug ?? ""}
                name={tl.tag?.name ?? ""}
                category={tl.tag?.category ?? "device_type"}
              />
            ))}
          </div>

          {/* Device */}
          {ann.device && (
            <div className="mt-2 flex items-center gap-2 text-2xs text-gray-500">
              <svg aria-hidden className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
              </svg>
              <Link
                href={`/dashboard/devices/${ann.deviceId}`}
                className="font-medium text-gray-700 hover:text-brand-700"
              >
                {ann.device.name}
              </Link>
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-gray-500">{ann.device.sku}</code>
            </div>
          )}

          {/* Title */}
          <h2 className="mt-2 text-sm font-semibold text-gray-900 leading-snug">{ann.title}</h2>

          {/* Body (truncated) */}
          <p className="mt-1.5 line-clamp-3 text-xs text-gray-600 leading-relaxed">{ann.body}</p>

          {/* Footer */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            {/* Author */}
            {ann.author && (
              <div className="flex items-center gap-1.5 text-2xs text-gray-500">
                <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-2xs font-bold text-brand-700">
                  {ann.author.fullName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="font-medium text-gray-700">{ann.author.fullName}</span>
                {(ann.author as any).verificationTier !== undefined && (
                  <TierBadge tier={(ann.author as any).verificationTier} />
                )}
                {ann.author.specialty && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="capitalize">{ann.author.specialty.replace(/_/g, " ")}</span>
                  </>
                )}
              </div>
            )}
            <time dateTime={ann.createdAt} className="text-2xs text-gray-400">
              {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </time>
          </div>

          {/* Comments toggle */}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <CommentsPanel annotationId={ann.id} initialCount={commentCount} />
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Main Feed Component ───────────────────────────────────────────────────────

export function AnnotationFeed({
  initialAnnotations,
  initialTotal,
}: {
  initialAnnotations: (Annotation & { voteScore?: number; userVote?: number; commentCount?: number; tags?: any[] })[];
  initialTotal: number;
}) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort = (searchParams.get("sort") ?? "top") as "top" | "newest" | "discussed";

  const updateSort = (sort: "top" | "newest" | "discussed") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="space-y-4">
      {/* Sort bar */}
      <div className="flex items-center justify-between">
        <SortBar sort={currentSort} onSort={updateSort} />
        <p className="text-xs text-gray-500">
          {isPending ? "Sorting…" : <><span className="font-semibold text-gray-700">{initialTotal}</span> annotations</>}
        </p>
      </div>

      {/* Feed */}
      {initialAnnotations.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <p className="text-sm text-gray-500">No annotations match these filters.</p>
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
          {initialAnnotations.map(ann => (
            <AnnotationCard key={ann.id} ann={ann} />
          ))}
        </div>
      )}
    </div>
  );
}
