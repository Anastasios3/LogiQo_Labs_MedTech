"use client";

/**
 * PendingDevicesTable — live-polling table of devices awaiting admin approval.
 *
 * Polling:
 *   TanStack Query refetchInterval: 30s.  A "Refreshing…" indicator appears in
 *   the table header during background re-fetches so the safety officer knows
 *   the list is live without a jarring full skeleton reload.
 *
 * Behaviour:
 *   - Initial load: skeleton (3 row placeholders)
 *   - Subsequent re-fetches: stale data stays visible, subtle "Refreshing…" banner
 *   - Error: friendly message, no crash
 *   - Empty: "all caught up" state
 *
 * Navigation: clicking "Review" links to /dashboard/admin/devices/:id.
 * After approval/rejection, the next 30s poll (or page revisit) will remove
 * the device from this list automatically.
 */

import Link            from "next/link";
import { useQuery }    from "@tanstack/react-query";
import { apiClient }   from "@/lib/api-client";
import type { Device } from "@logiqo/shared";

const REFETCH_INTERVAL_MS = 30_000;

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PendingTableSkeleton() {
  return (
    <div className="card overflow-hidden" role="status" aria-label="Loading pending approvals…">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-44 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PendingDevicesTable() {
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["admin", "pending"],
    queryFn:  () => apiClient.admin.pendingDevices({ limit: 20 }),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const devices: Device[] = data?.data ?? [];

  // ── Initial load ─────────────────────────────────────────────────────────

  if (isLoading) return <PendingTableSkeleton />;

  // ── Error ─────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          API unavailable — cannot load pending approvals
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────

  if (devices.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          No pending approvals — all caught up!
        </div>
      </div>
    );
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  return (
    <div className="card overflow-hidden">
      {/* Live-update banner — shown during background re-fetches */}
      {isFetching && (
        <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-1.5 text-xs text-indigo-600">
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>Refreshing — updates every 30 s</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="data-table" aria-label="Devices awaiting approval">
          <caption className="sr-only">
            Devices submitted for review, awaiting safety officer approval.
            Refreshes automatically every 30 seconds.
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
            {devices.map((device) => (
              <tr key={device.id}>
                <td>
                  <p className="font-semibold text-gray-900">{device.name}</p>
                  <p className="font-mono text-2xs text-gray-400 mt-0.5">{device.sku}</p>
                </td>
                <td className="text-gray-700">{device.manufacturer?.name ?? "—"}</td>
                <td className="text-gray-600">{device.category?.name ?? "—"}</td>
                <td>
                  <time
                    className="text-sm text-gray-500"
                    dateTime={device.createdAt}
                  >
                    {new Date(device.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day:   "numeric",
                      year:  "numeric",
                    })}
                  </time>
                </td>
                <td>
                  <div className="flex items-center justify-end">
                    <Link
                      href={`/dashboard/admin/devices/${device.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      Review
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-600">{devices.length}</span>{" "}
          device{devices.length !== 1 ? "s" : ""} awaiting review ·{" "}
          auto-refreshes every 30 s
        </p>
      </div>
    </div>
  );
}
