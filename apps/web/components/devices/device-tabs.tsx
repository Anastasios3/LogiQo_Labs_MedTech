"use client";

import { useState } from "react";
import type { Device, Annotation } from "@logiqo/shared";
import { DeviceAnnotationFeed } from "@/components/devices/device-annotation-feed";

interface DeviceTabsProps {
  device:      Device;
  annotations: Annotation[];
}

const TABS = [
  { id: "overview",    label: "Overview"          },
  { id: "technical",   label: "Technical Specs"   },
  { id: "regulatory",  label: "Regulatory"        },
  { id: "annotations", label: "Peer Annotations"  },
] as const;

type TabId = typeof TABS[number]["id"];

// Helper: render a JSON object as a key-value table
function JsonTable({ data, label }: { data: Record<string, unknown>; label: string }) {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</h4>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {entries.map(([key, val]) => (
              <tr key={key} className="bg-white hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-600 w-1/3 capitalize">
                  {key.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-800">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function DeviceTabs({ device, annotations }: DeviceTabsProps) {
  const [active, setActive] = useState<TabId>("overview");

  return (
    <div className="card overflow-hidden">
      {/* Tab strip */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="flex overflow-x-auto" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={[
                "flex-shrink-0 px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-100 whitespace-nowrap",
                active === tab.id
                  ? "border-indigo-600 text-indigo-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              ].join(" ")}
            >
              {tab.label}
              {tab.id === "annotations" && annotations.length > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">
                  {annotations.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div className="p-6">

        {/* ── Overview ──────────────────────────────────────────────────── */}
        {active === "overview" && (
          <div id="panel-overview" role="tabpanel" className="space-y-5">
            {device.description ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Description</h4>
                <p className="text-sm leading-relaxed text-gray-700">{device.description}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No description provided.</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {device.modelNumber && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Model Number</p>
                  <p className="mt-1 font-mono text-sm text-gray-800">{device.modelNumber}</p>
                </div>
              )}
              {device.version && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Version</p>
                  <p className="mt-1 font-mono text-sm text-gray-800">{device.version}</p>
                </div>
              )}
              {device.sterilizationMethod && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Sterilization</p>
                  <p className="mt-1 text-sm text-gray-800">{device.sterilizationMethod}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Technical ─────────────────────────────────────────────────── */}
        {active === "technical" && (
          <div id="panel-technical" role="tabpanel" className="space-y-6">
            {device.materialComposition
              ? <JsonTable data={device.materialComposition as Record<string, unknown>} label="Material Composition" />
              : null}
            {device.dimensionsMm
              ? <JsonTable data={device.dimensionsMm as Record<string, unknown>} label="Dimensions (mm)" />
              : null}
            {device.compatibilityMatrix
              ? <JsonTable data={device.compatibilityMatrix as Record<string, unknown>} label="Compatibility Matrix" />
              : null}
            {device.extractionTooling
              ? <JsonTable data={device.extractionTooling as Record<string, unknown>} label="Extraction Tooling" />
              : null}
            {!device.materialComposition && !device.dimensionsMm && !device.compatibilityMatrix && !device.extractionTooling && (
              <p className="text-sm text-gray-400 italic">No technical specifications on record.</p>
            )}
          </div>
        )}

        {/* ── Regulatory ────────────────────────────────────────────────── */}
        {active === "regulatory" && (
          <div id="panel-regulatory" role="tabpanel" className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Regulatory Status</p>
                <span className={`badge badge-${device.regulatoryStatus ?? "pending"}`}>
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${
                    device.regulatoryStatus === "approved" ? "bg-emerald-500" :
                    device.regulatoryStatus === "recalled"  ? "bg-red-500"     :
                    device.regulatoryStatus === "withdrawn" ? "bg-gray-400"    : "bg-amber-500"
                  }`} />
                  {device.regulatoryStatus ?? "Pending"}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Approval Status</p>
                <span className={`badge badge-${device.approvalStatus === "approved" ? "approved" : device.approvalStatus === "rejected" ? "recalled" : "pending"}`}>
                  {device.approvalStatus ?? "Pending"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {device.fdA510kNumber && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">FDA 510(k) Number</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-gray-800">{device.fdA510kNumber}</p>
                </div>
              )}
              {device.ceMmarkNumber && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">CE Mark Number</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-gray-800">{device.ceMmarkNumber}</p>
                </div>
              )}
            </div>

            {!device.fdA510kNumber && !device.ceMmarkNumber && (
              <p className="text-sm text-gray-400 italic">No regulatory identifiers on record.</p>
            )}
          </div>
        )}

        {/* ── Annotations ───────────────────────────────────────────────── */}
        {active === "annotations" && (
          <div id="panel-annotations" role="tabpanel">
            <DeviceAnnotationFeed
              deviceId={device.id}
              initialAnnotations={annotations}
              initialTotal={annotations.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}
