import Link from "next/link";
import { apiClient } from "@/lib/api-client";

interface DeviceTableProps {
  searchParams: {
    q?: string;
    category?: string;
    manufacturer?: string;
    page?: string;
  };
}

export async function DeviceTable({ searchParams }: DeviceTableProps) {
  const response = await apiClient.devices.list({
    q: searchParams.q,
    category: searchParams.category,
    manufacturer: searchParams.manufacturer,
    page: searchParams.page ? Number(searchParams.page) : 1,
    limit: 20,
  });

  if (!response.data.length) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500">No devices found matching your search.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Device
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Manufacturer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {response.data.map((device) => (
            <tr key={device.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {device.name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{device.sku}</p>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {device.manufacturer?.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {device.category?.name}
              </td>
              <td className="px-6 py-4">
                <RegulatoryBadge status={device.regulatoryStatus} />
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/dashboard/devices/${device.id}`}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegulatoryBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "badge-low",
    recalled: "badge-critical",
    pending: "badge-medium",
    withdrawn: "badge-high",
  };
  return (
    <span className={map[status] ?? "badge-medium"}>
      {status}
    </span>
  );
}
