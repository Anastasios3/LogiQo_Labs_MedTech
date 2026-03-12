"use client";

/**
 * DeviceListClient — TanStack Query-backed device table.
 *
 * Reads filter / pagination state from URL searchParams (via useSearchParams)
 * so it stays in sync with DeviceSearch navigation and produces shareable URLs.
 *
 * Caching:
 *   - staleTime / gcTime / refetchOnWindowFocus are configured globally in
 *     app/providers.tsx — no per-query overrides needed here.
 *
 * Pagination:
 *   Prev / Next links are rendered as <Link> elements so navigation is handled
 *   by Next.js router. The URL change triggers useSearchParams() to update,
 *   which in turn changes the queryKey, causing TanStack Query to re-fetch.
 *
 * Loading states:
 *   - isLoading (first fetch): full skeleton
 *   - isFetching (background re-fetch): subtle "Refreshing…" banner while
 *     stale data remains visible — prevents jarring skeleton flashes.
 */

import Link                from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery }        from "@tanstack/react-query";
import { apiClient }       from "@/lib/api-client";
import type { Device }     from "@logiqo/shared";

// ── Config ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const REGULATORY_STATUS_CONFIG = {
  approved:  { badge: "badge-approved", dot: "bg-emerald-500", label: "Approved"  },
  pending:   { badge: "badge-pending",  dot: "bg-amber-500",   label: "Pending"   },
  recalled:  { badge: "badge-recalled", dot: "bg-red-500",     label: "Recalled"  },
  withdrawn: { badge: "badge-inactive", dot: "bg-gray-400",    label: "Withdrawn" },
} as const;

type RegulatoryStatus = keyof typeof REGULATORY_STATUS_CONFIG;

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DeviceListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary pill skeletons */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="card overflow-hidden" role="status" aria-label="Loading devices…">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-52 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-36 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
              <div className="h-7 w-14 animate-pulse rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeviceListClient() {
  const searchParams = useSearchParams();

  // Pull filter values from URL
  const q            = searchParams.get("q")            ?? undefined;
  const category     = searchParams.get("category")     ?? undefined;
  const manufacturer = searchParams.get("manufacturer") ?? undefined;
  const status       = searchParams.get("status")       ?? undefined;
  const page         = Math.max(1, Number(searchParams.get("page") ?? 1));

  const queryKey = ["devices", { q, category, manufacturer, status, page }] as const;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.devices.list({
        q,
        category,
        manufacturer,
        status,
        page,
        limit: PAGE_SIZE,
      }),
  });

  // ── Build pagination URLs ──────────────────────────────────────────────────

  function buildPageUrl(newPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) params.delete("page");
    else              params.set("page", String(newPage));
    return `/dashboard/devices?${params.toString()}`;
  }

  // ── Initial loading ────────────────────────────────────────────────────────

  if (isLoading) return <DeviceListSkeleton />;

  // ── Derived values ─────────────────────────────────────────────────────────

  const devices    = data?.data    ?? [];
  const total      = data?.total   ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const approvedCount = devices.filter((d) => d.regulatoryStatus === "approved").length;
  const recalledCount = devices.filter((d) => d.regulatoryStatus === "recalled").length;
  const pendingCount  = devices.filter(
    (d) => d.regulatoryStatus === "pending" || d.approvalStatus === "pending"
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="font-semibold text-gray-900">{approvedCount}</span>
          <span className="text-gray-500">Approved</span>
        </div>
        {recalledCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
            <span className="font-semibold text-red-900">{recalledCount}</span>
            <span className="text-red-600">Recalled</span>
          </div>
        )}
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="font-semibold text-gray-900">{pendingCount}</span>
            <span className="text-gray-500">Pending</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
          <span className="font-semibold text-gray-900">{total}</span>
          <span className="text-gray-500">Total</span>
        </div>

        {/* Background-refresh indicator */}
        {isFetching && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-500">
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span>Refreshing…</span>
          </div>
        )}
      </div>

      {/* API error banner */}
      {isError && (
        <div className="preview-banner">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          API not reachable — start the API server to load live data
        </div>
      )}

      {/* Device table / empty state */}
      <div className="card overflow-hidden">
        {devices.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table" aria-label="Medical device index">
                <caption className="sr-only">
                  Medical devices in the hardware index — name, manufacturer, category, regulatory status,
                  and peer annotation count
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Device</th>
                    <th scope="col">Manufacturer</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col" data-numeric="true">Annotations</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device: Device) => {
                    const statusKey      = (device.regulatoryStatus ?? "pending") as RegulatoryStatus;
                    const s              = REGULATORY_STATUS_CONFIG[statusKey] ?? REGULATORY_STATUS_CONFIG.pending;
                    const annotationCount = device._count?.annotations ?? 0;

                    return (
                      <tr key={device.id}>
                        <td>
                          <p className="font-semibold text-gray-900 leading-snug">{device.name}</p>
                          <p className="mt-0.5 font-mono text-2xs text-gray-400 tracking-wide">{device.sku}</p>
                        </td>
                        <td className="text-gray-700">{device.manufacturer?.name ?? "—"}</td>
                        <td className="text-gray-600">{device.category?.name ?? "—"}</td>
                        <td>
                          <span className={s.badge}>
                            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td data-numeric="true">
                          {annotationCount > 0 ? (
                            <span
                              className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
                              aria-label={`${annotationCount} peer annotations`}
                            >
                              {annotationCount}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs" aria-label="No annotations">—</span>
                          )}
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/devices/${device.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
                            aria-label={`View details for ${device.name}`}
                          >
                            View
                            <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer: count + pagination */}
            <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-600">{devices.length}</span> of{" "}
                <span className="font-semibold text-gray-600">{total}</span> devices
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Link
                    href={buildPageUrl(page - 1)}
                    aria-disabled={page <= 1}
                    aria-label="Previous page"
                    className={[
                      "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      page <= 1
                        ? "pointer-events-none border-gray-100 bg-gray-50 text-gray-300"
                        : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600 shadow-sm",
                    ].join(" ")}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    Prev
                  </Link>

                  <span className="text-xs tabular-nums text-gray-400">
                    {page} / {totalPages}
                  </span>

                  <Link
                    href={buildPageUrl(page + 1)}
                    aria-disabled={page >= totalPages}
                    aria-label="Next page"
                    className={[
                      "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      page >= totalPages
                        ? "pointer-events-none border-gray-100 bg-gray-50 text-gray-300"
                        : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600 shadow-sm",
                    ].join(" ")}
                  >
                    Next
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
              <svg aria-hidden="true" className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-900">
              {q ? `No devices matching "${q}"` : "No devices found"}
            </h2>
            <p className="text-sm text-gray-500 max-w-xs">
              {q
                ? "Try a different search term or clear the filters."
                : "Run the database seed or adjust your filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
