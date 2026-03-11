import { notFound } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { DeviceTabs } from "@/components/devices/device-tabs";

interface PageProps {
  params: { id: string };
}

const STATUS_STYLE: Record<string, string> = {
  approved:  "badge-approved",
  recalled:  "badge-critical",
  withdrawn: "badge-neutral",
  pending:   "badge-pending",
};

const STATUS_DOT: Record<string, string> = {
  approved:  "bg-emerald-500",
  recalled:  "bg-red-500",
  withdrawn: "bg-gray-400",
  pending:   "bg-amber-400",
};

export default async function DeviceDetailPage({ params }: PageProps) {
  const [device, annotationsRes] = await Promise.allSettled([
    apiClient.devices.getById(params.id),
    apiClient.annotations.list({ deviceId: params.id, limit: 50 }),
  ]);

  if (device.status === "rejected") notFound();

  const dev       = device.value;
  const annotations = annotationsRes.status === "fulfilled" ? annotationsRes.value.data : [];

  const statusKey = dev.regulatoryStatus ?? "pending";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/devices" className="hover:text-gray-800 transition-colors">
          Hardware Index
        </Link>
        <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium truncate max-w-xs">{dev.name}</span>
      </nav>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{dev.name}</h1>
          {dev.modelNumber && (
            <p className="mt-1 font-mono text-sm text-gray-500">{dev.modelNumber}</p>
          )}
        </div>
        <span className={`badge ${STATUS_STYLE[statusKey] ?? "badge-pending"} text-sm px-3 py-1`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[statusKey] ?? "bg-amber-400"}`} />
          {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main: Tabbed content */}
        <div className="lg:col-span-2">
          <DeviceTabs device={dev} annotations={annotations} />
        </div>

        {/* Sidebar: Summary card */}
        <div className="space-y-4">
          {/* Quick Facts */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Quick Facts</h3>

            <dl className="space-y-3 text-sm">
              {dev.manufacturer && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400 shrink-0">Manufacturer</dt>
                  <dd className="text-gray-800 font-medium text-right">{dev.manufacturer.name}</dd>
                </div>
              )}
              {dev.category && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400 shrink-0">Category</dt>
                  <dd className="text-gray-800 text-right">{dev.category.name}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400 shrink-0">SKU</dt>
                <dd className="font-mono text-gray-800">{dev.sku}</dd>
              </div>
              {dev.version && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400 shrink-0">Version</dt>
                  <dd className="font-mono text-gray-800">{dev.version}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400 shrink-0">Approval</dt>
                <dd>
                  <span className={`badge text-xs ${dev.approvalStatus === "approved" ? "badge-approved" : dev.approvalStatus === "rejected" ? "badge-critical" : "badge-pending"}`}>
                    {dev.approvalStatus ?? "Pending"}
                  </span>
                </dd>
              </div>
              {dev.sterilizationMethod && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400 shrink-0">Sterilization</dt>
                  <dd className="text-gray-800 text-right">{dev.sterilizationMethod}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400 shrink-0">Annotations</dt>
                <dd className="font-semibold text-indigo-600">
                  {annotations.length}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400 shrink-0">Added</dt>
                <dd className="text-gray-800">
                  {new Date(dev.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Documents */}
          {dev.documents && dev.documents.length > 0 && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Documents</h3>
              <ul className="space-y-2">
                {dev.documents.map((doc: { id: string; title: string; documentType: string; version?: string | null; mimeType?: string | null; fileSizeBytes?: number | null }) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{doc.documentType.replace(/_/g, " ")}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {doc.fileSizeBytes ? `${(doc.fileSizeBytes / 1024).toFixed(0)} KB` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Annotate CTA */}
          <Link
            href={`/dashboard/annotations/new?deviceId=${dev.id}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-sm font-medium text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Submit Peer Annotation
          </Link>
        </div>
      </div>
    </div>
  );
}
