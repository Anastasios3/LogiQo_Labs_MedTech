import { Suspense } from "react";
import { DeviceSearch }     from "@/components/devices/device-search";
import { DeviceListClient } from "@/components/devices/device-list-client";
import { apiClient }        from "@/lib/api-client";

export const metadata = {
  title: "Hardware Index | LogiQo MedTech",
};

function DeviceTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="card overflow-hidden" role="status" aria-label="Loading devices…">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (
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
      </div>
    </div>
  );
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; manufacturer?: string; status?: string; page?: string };
}) {
  // Fetch filter metadata server-side so the search dropdowns are populated
  // on first render (no client-side loading state for manufacturer / category lists).
  const meta = await apiClient.devices.meta().catch(() => ({
    manufacturers: [] as { id: string; name: string; slug: string }[],
    categories:    [] as { id: string; name: string; code: string }[],
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hardware Index</h1>
          <p className="page-subtitle">
            Search and filter implants, devices, and proprietary tooling across all manufacturers
          </p>
        </div>
      </div>

      <DeviceSearch
        initialQuery={searchParams.q}
        initialStatus={searchParams.status}
        initialCategory={searchParams.category}
        initialManufacturer={searchParams.manufacturer}
        meta={meta}
      />

      {/*
        DeviceListClient is a "use client" component that owns its own data
        fetching via TanStack Query. The Suspense boundary catches the initial
        useSearchParams() suspension and shows the skeleton.
      */}
      <Suspense fallback={<DeviceTableSkeleton />}>
        <DeviceListClient />
      </Suspense>
    </div>
  );
}
