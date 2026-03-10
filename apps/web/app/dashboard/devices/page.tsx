import { Suspense } from "react";
import { DeviceSearch } from "@/components/devices/device-search";

export const metadata = {
  title: "Hardware Index | LogiQo MedTech",
};

/* ─── Status configuration ──────────────────────────────────────────────────
   Refactoring UI: never rely on color alone — pair with shape/text.
   Each status has a dot color AND a badge class for redundant cues.
────────────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  approved: { badge: "badge-approved", dot: "bg-emerald-500", label: "Approved" },
  pending:  { badge: "badge-pending",  dot: "bg-amber-500",   label: "Pending"  },
  recalled: { badge: "badge-recalled", dot: "bg-red-500",     label: "Recalled" },
  inactive: { badge: "badge-inactive", dot: "bg-gray-400",    label: "Inactive" },
} as const;

type DeviceStatus = keyof typeof STATUS_CONFIG;

const mockDevices = [
  {
    id: "1", name: "Accolade II Hip Stem 28mm",
    sku: "STR-ACCOLADE-II-28", manufacturer: "Stryker",
    category: "Hip Replacement",         status: "approved" as DeviceStatus, annotations: 3,
  },
  {
    id: "2", name: "Visia AF ICD – 3T MRI Compatible",
    sku: "MDT-VISIA-AF-ICD-3T", manufacturer: "Medtronic",
    category: "Cardiac Electrophysiology", status: "pending" as DeviceStatus, annotations: 0,
  },
  {
    id: "3", name: "Triathlon Knee System",
    sku: "STR-TRIATHLON-KS-65", manufacturer: "Stryker",
    category: "Knee Replacement",        status: "approved" as DeviceStatus, annotations: 7,
  },
  {
    id: "4", name: "Continuum Acetabular System",
    sku: "ZB-CONTINUUM-28", manufacturer: "Zimmer Biomet",
    category: "Hip Replacement",         status: "recalled" as DeviceStatus, annotations: 12,
  },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function DevicesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; manufacturer?: string };
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hardware Index</h1>
          <p className="page-subtitle">
            Search implants, devices, and proprietary tooling across all manufacturers
          </p>
        </div>

        {/* Summary pills — quick at-a-glance counts (Refactoring UI: surface data hierarchy) */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-card">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="font-semibold text-gray-900">2</span>
            <span className="text-gray-500">Approved</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 shadow-card">
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
            <span className="font-semibold text-red-900">1</span>
            <span className="text-red-600">Recalled</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-card">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="font-semibold text-gray-900">1</span>
            <span className="text-gray-500">Pending</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <DeviceSearch initialQuery={searchParams.q} />

      {/* Table */}
      <Suspense fallback={<DeviceTableSkeleton />}>
        <DeviceTablePlaceholder />
      </Suspense>
    </div>
  );
}

/* ─── Device table ─────────────────────────────────────────────────────────── */
function DeviceTablePlaceholder() {
  return (
    <div className="card overflow-hidden">
      {/* Preview banner */}
      <div className="preview-banner rounded-none border-x-0 border-t-0">
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        Preview data — connect API + database to load live records
      </div>

      {/* Accessible table — Inclusive Components: th scope, caption, no layout tables */}
      <div className="overflow-x-auto">
        <table className="data-table" aria-label="Medical device index">
          <caption className="sr-only">
            List of medical devices in the hardware index, showing name, manufacturer, category, status, and peer annotation count
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
            {mockDevices.map((device) => {
              const s = STATUS_CONFIG[device.status];
              return (
                <tr key={device.id}>
                  {/* Name + SKU — primary data, highest visual weight */}
                  <td>
                    <p className="font-semibold text-gray-900 leading-snug">{device.name}</p>
                    <p className="mt-0.5 font-mono text-2xs text-gray-400 tracking-wide">{device.sku}</p>
                  </td>

                  <td className="text-gray-700">{device.manufacturer}</td>
                  <td className="text-gray-600">{device.category}</td>

                  {/* Status — dot + label = two visual cues for colorblind users */}
                  <td>
                    <span className={s.badge}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>

                  {/* Annotation count pill */}
                  <td data-numeric="true">
                    {device.annotations > 0 ? (
                      <span
                        className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
                        aria-label={`${device.annotations} peer annotations`}
                      >
                        {device.annotations}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs" aria-label="No annotations">—</span>
                    )}
                  </td>

                  <td>
                    <button
                      className="btn-ghost text-xs py-1 px-2"
                      aria-label={`View details for ${device.name}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Showing <span className="font-semibold text-gray-600">{mockDevices.length}</span> of{" "}
          <span className="font-semibold text-gray-600">{mockDevices.length}</span> devices
        </p>
        <p className="text-xs text-gray-400 hidden sm:block">
          Connect database for live search &amp; pagination
        </p>
      </div>
    </div>
  );
}

/* ─── Loading skeleton — communicates structure before content loads ─────────
   Inclusive Components: aria-busy signals loading to assistive technology
────────────────────────────────────────────────────────────────────────── */
function DeviceTableSkeleton() {
  return (
    <div className="card overflow-hidden" role="status" aria-label="Loading devices…">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-52 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-36 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading devices, please wait</span>
    </div>
  );
}
