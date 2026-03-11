import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import type { Annotation } from "@logiqo/shared";
import { AnnotationFeed } from "@/components/annotations/annotation-feed";

export const metadata = {
  title: "Peer Telemetry | LogiQo MedTech",
};

interface Props {
  searchParams: {
    sort?:     "top" | "newest" | "discussed";
    tag?:      string;
    severity?: string;
    type?:     string;
    page?:     string;
  };
}

export default async function AnnotationsPage({ searchParams }: Props) {
  const sort     = searchParams.sort     ?? "top";
  const tag      = searchParams.tag;
  const severity = searchParams.severity;
  const type     = searchParams.type;
  const page     = parseInt(searchParams.page ?? "1", 10);

  const result = await apiClient.annotations
    .list({ sort, tag, severity, type, page, limit: 20 })
    .catch(() => ({ data: [] as Annotation[], total: 0, page: 1, limit: 20 }));

  const { data: annotations, total } = result;
  const apiDown = total === 0 && annotations.length === 0;

  const criticalCount  = annotations.filter((a: any) => a.severity === "critical").length;
  const publishedCount = annotations.filter((a: any) => a.isPublished).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Peer Telemetry</h1>
          <p className="page-subtitle">
            Clinician-reported observations, technique tips, and adverse events — ranked by verified peer votes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-card">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            <span className="font-semibold text-gray-900">{publishedCount}</span>
            <span className="text-gray-500">Published</span>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" aria-hidden />
              <span className="font-semibold text-red-700">{criticalCount}</span>
              <span className="text-red-600">Critical</span>
            </div>
          )}
          <Link href="/dashboard/annotations/new" className="btn-primary">
            <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Submit Annotation
          </Link>
        </div>
      </div>

      {/* Verification tier legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Vote weight:</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-violet-100 border border-violet-200 px-1.5 py-0.5 text-violet-700 font-medium text-xs">✓✓ Trusted</span>
          <span>Tier 3 — 1.5×</span>
        </span>
        <span className="text-gray-300">|</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-emerald-700 font-medium text-xs">✓ Verified</span>
          <span>Tier 2 (NPI) — 1.0×</span>
        </span>
        <span className="text-gray-300">|</span>
        <span>Tier 0–1 — not counted</span>
      </div>

      {/* API unavailable notice */}
      {apiDown && (
        <div className="preview-banner">
          <svg aria-hidden className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          API not reachable — start the API server to load peer annotations
        </div>
      )}

      {/* Ranked Feed (client component for voting + comments + sorting) */}
      {!apiDown && annotations.length > 0 && (
        <AnnotationFeed
          initialAnnotations={annotations as any}
          initialTotal={total}
        />
      )}

      {/* Empty state */}
      {annotations.length === 0 && !apiDown && (
        <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <svg aria-hidden className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">No annotations yet</h2>
            <p className="mt-1 text-sm text-gray-500 max-w-sm">
              NPI-verified clinicians (tier 2+) can submit peer-reviewed observations.
              All submissions are reviewed before publication.
            </p>
          </div>
          <Link href="/dashboard/annotations/new" className="btn-primary">
            Submit an annotation
          </Link>
        </div>
      )}
    </div>
  );
}
