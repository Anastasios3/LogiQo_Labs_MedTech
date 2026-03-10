import { Suspense } from "react";
import { DeviceSearch } from "@/components/devices/device-search";

export const metadata = {
  title: "Hardware Index | LogiQo MedTech",
};

export default function DevicesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; manufacturer?: string };
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hardware Index</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search implants, devices, and proprietary tooling across all
            manufacturers
          </p>
        </div>
      </div>

      <DeviceSearch initialQuery={searchParams.q} />

      <Suspense fallback={<DeviceTableSkeleton />}>
        <DeviceTablePlaceholder />
      </Suspense>
    </div>
  );
}

// Placeholder until API is connected
function DeviceTablePlaceholder() {
  const mockDevices = [
    {
      id: "1",
      name: "Accolade II Hip Stem 28mm",
      sku: "STR-ACCOLADE-II-28",
      manufacturer: "Stryker",
      category: "Hip Replacement",
      status: "approved",
    },
    {
      id: "2",
      name: "Visia AF ICD – 3T MRI Compatible",
      sku: "MDT-VISIA-AF-ICD-3T",
      manufacturer: "Medtronic",
      category: "Cardiac Electrophysiology",
      status: "pending",
    },
    {
      id: "3",
      name: "Triathlon Knee System",
      sku: "STR-TRIATHLON-KS-65",
      manufacturer: "Stryker",
      category: "Knee Replacement",
      status: "approved",
    },
    {
      id: "4",
      name: "Continuum Acetabular System",
      sku: "ZB-CONTINUUM-28",
      manufacturer: "Zimmer Biomet",
      category: "Hip Replacement",
      status: "recalled",
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-700">
        Preview data — connect API + database to load live records
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Device</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Manufacturer</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {mockDevices.map((device) => (
            <tr key={device.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <p className="text-sm font-medium text-gray-900">{device.name}</p>
                <p className="text-xs text-gray-500 font-mono">{device.sku}</p>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{device.manufacturer}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{device.category}</td>
              <td className="px-6 py-4">
                <span className={
                  device.status === "approved" ? "badge-low" :
                  device.status === "recalled" ? "badge-critical" :
                  "badge-medium"
                }>
                  {device.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceTableSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="p-6 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}
