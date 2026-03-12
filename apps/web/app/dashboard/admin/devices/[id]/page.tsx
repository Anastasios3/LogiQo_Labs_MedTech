"use client";

import { useState, useEffect }  from "react";
import { useRouter }            from "next/navigation";
import Link                     from "next/link";
import { apiClient }            from "@/lib/api-client";
import { useToast }             from "@/components/ui/toast";
import type { Device, Annotation } from "@logiqo/shared";

/* ─── Field row ─────────────────────────────────────────────────────────── */
function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <dt className="text-sm text-gray-400 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 text-right font-mono">{value}</dd>
    </div>
  );
}

/* ─── JSON section ──────────────────────────────────────────────────────── */
function JsonSection({ label, data }: { label: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{label}</h4>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {entries.map(([k, v]) => (
              <tr key={k} className="bg-white">
                <td className="px-3 py-2 text-gray-500 capitalize w-1/3">{k.replace(/_/g, " ")}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-800">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Status badges ─────────────────────────────────────────────────────── */
const REG_DOT: Record<string, string> = {
  approved:  "bg-emerald-500",
  recalled:  "bg-red-500",
  withdrawn: "bg-gray-400",
  pending:   "bg-amber-400",
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function AdminDeviceReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast  = useToast();
  const [device,      setDevice]      = useState<Device | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);

  const [approving,   setApproving]   = useState(false);
  const [rejecting,   setRejecting]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject,  setShowReject]  = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      apiClient.devices.getById(params.id),
      apiClient.annotations.list({ deviceId: params.id, limit: 20 }),
    ]).then(([dRes, aRes]) => {
      if (dRes.status === "rejected") { setNotFound(true); }
      else { setDevice(dRes.value as unknown as Device); }
      if (aRes.status === "fulfilled") setAnnotations(aRes.value.data as unknown as Annotation[]);
      setLoading(false);
    });
  }, [params.id]);

  async function handleApprove() {
    if (!device) return;
    setApproving(true);
    setActionError("");
    try {
      await apiClient.admin.approveDevice(device.id);
      toast.success(
        "Device approved",
        `${device.name} is now live in the Hardware Index.`,
      );
      router.push("/dashboard/admin");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Approval failed");
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!device || !rejectReason.trim()) return;
    setRejecting(true);
    setActionError("");
    try {
      await apiClient.admin.rejectDevice(device.id, rejectReason.trim());
      toast.info(
        "Device rejected",
        `${device.name} has been rejected. The decision is recorded in the audit log.`,
      );
      router.push("/dashboard/admin");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Rejection failed");
      setRejecting(false);
    }
  }

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-100" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6 space-y-4">
            <div className="h-6 w-48 rounded bg-gray-100" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-4/5 rounded bg-gray-100" />
          </div>
          <div className="card p-5 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-4 w-full rounded bg-gray-100" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !device) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Device not found.</p>
        <Link href="/dashboard/admin" className="mt-4 btn btn-secondary inline-flex">
          Back to Admin
        </Link>
      </div>
    );
  }

  const regKey = device.regulatoryStatus ?? "pending";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/admin" className="hover:text-gray-800 transition-colors">Admin Dashboard</Link>
        <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium">Device Review</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
          <p className="text-sm text-gray-400 font-mono mt-0.5">{device.sku}</p>
        </div>
        <span className="badge badge-pending">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Awaiting Review
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Overview */}
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Overview</h2>
            {device.description ? (
              <p className="text-sm text-gray-700 leading-relaxed">{device.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No description provided.</p>
            )}
            <dl>
              <FieldRow label="Model Number"        value={device.modelNumber} />
              <FieldRow label="Version"             value={device.version} />
              <FieldRow label="Sterilization"       value={device.sterilizationMethod} />
              <FieldRow label="FDA 510(k)"          value={device.fdA510kNumber} />
              <FieldRow label="CE Mark"             value={device.ceMmarkNumber} />
            </dl>
          </div>

          {/* Technical */}
          {(device.materialComposition || device.dimensionsMm || device.compatibilityMatrix || device.extractionTooling) && (
            <div className="card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Technical Specifications</h2>
              {device.materialComposition && (
                <JsonSection label="Material Composition" data={device.materialComposition as Record<string, unknown>} />
              )}
              {device.dimensionsMm && (
                <JsonSection label="Dimensions (mm)" data={device.dimensionsMm as Record<string, unknown>} />
              )}
              {device.compatibilityMatrix && (
                <JsonSection label="Compatibility Matrix" data={device.compatibilityMatrix as Record<string, unknown>} />
              )}
              {device.extractionTooling && (
                <JsonSection label="Extraction Tooling" data={device.extractionTooling as Record<string, unknown>} />
              )}
            </div>
          )}

          {/* Annotations summary */}
          {annotations.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Peer Annotations ({annotations.length})
              </h2>
              <div className="space-y-3">
                {annotations.slice(0, 5).map(ann => (
                  <div key={ann.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge badge-info text-xs capitalize">{ann.annotationType.replace(/_/g, " ")}</span>
                      {ann.severity && (
                        <span className={`badge text-xs capitalize ${
                          ann.severity === "critical" ? "badge-critical" :
                          ann.severity === "high"     ? "badge-high"     :
                          ann.severity === "medium"   ? "badge-medium"   : "badge-low"
                        }`}>{ann.severity}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{ann.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ann.body}</p>
                  </div>
                ))}
                {annotations.length > 5 && (
                  <p className="text-xs text-gray-400 text-center">+{annotations.length - 5} more annotations</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Facts */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Quick Facts</h3>
            <dl className="space-y-2.5 text-sm">
              {device.manufacturer && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Manufacturer</dt>
                  <dd className="text-gray-800 font-medium text-right">{(device.manufacturer as { name: string }).name}</dd>
                </div>
              )}
              {device.category && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-400">Category</dt>
                  <dd className="text-gray-800 text-right">{(device.category as { name: string }).name}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">Reg. Status</dt>
                <dd>
                  <span className={`badge badge-${regKey} text-xs`}>
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${REG_DOT[regKey] ?? "bg-amber-400"}`} />
                    {regKey}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">Submitted</dt>
                <dd className="text-gray-800">
                  {new Date(device.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-400">Annotations</dt>
                <dd className="text-indigo-600 font-semibold">{annotations.length}</dd>
              </div>
            </dl>
          </div>

          {/* Action panel */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Decision</h3>

            {actionError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {/* Approve */}
            <button
              onClick={handleApprove}
              disabled={approving || rejecting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {approving ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              {approving ? "Approving…" : "Approve Device"}
            </button>

            {/* Reject toggle */}
            {!showReject ? (
              <button
                onClick={() => setShowReject(true)}
                disabled={approving || rejecting}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Reject Device
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <label className="block text-sm font-medium text-red-700">Rejection reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Describe why this device is being rejected…"
                  rows={3}
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowReject(false); setRejectReason(""); }}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || rejecting}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {rejecting ? "Rejecting…" : "Confirm Reject"}
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              All decisions are recorded in the immutable audit log.
            </p>
          </div>

          <Link
            href="/dashboard/admin"
            className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
