"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type { GudidDeviceInfo } from "@logiqo/shared";

interface Props {
  manufacturers: { id: string; name: string; slug: string }[];
  categories:    { id: string; name: string; code: string }[];
}

const REG_STATUSES = ["pending", "approved", "recalled", "withdrawn"] as const;

export function AddDeviceForm({ manufacturers, categories }: Props) {
  const router    = useRouter();
  const [, startT] = useTransition();

  const [open,    setOpen]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  // Form state
  const [sku,              setSku]              = useState("");
  const [name,             setName]             = useState("");
  const [manufacturerId,   setManufacturerId]   = useState("");
  const [categoryId,       setCategoryId]       = useState("");
  const [description,      setDescription]      = useState("");
  const [modelNumber,      setModelNumber]      = useState("");
  const [regulatoryStatus, setRegulatoryStatus] = useState<typeof REG_STATUSES[number]>("pending");

  // UDI lookup state
  const [udi,         setUdi]         = useState("");
  const [udiLooking,  setUdiLooking]  = useState(false);
  const [udiResult,   setUdiResult]   = useState<GudidDeviceInfo | null>(null);
  const [udiError,    setUdiError]    = useState("");

  const formValid = sku.trim() && name.trim() && manufacturerId && categoryId;

  async function handleUdiLookup() {
    if (!udi.trim()) return;
    setUdiLooking(true);
    setUdiError("");
    setUdiResult(null);
    try {
      const result = await apiClient.devices.gudidLookup(udi.trim());
      setUdiResult(result);
      // Auto-fill fields from GUDID data
      if (!name && result.deviceDescription) setName(result.deviceDescription.slice(0, 300));
      if (!modelNumber && result.versionModelNumber) setModelNumber(result.versionModelNumber);
      if (!sku) setSku(result.catalogNumber ?? udi.trim().slice(0, 100));
    } catch (err) {
      setUdiError(err instanceof Error ? err.message : "UDI not found in GUDID");
    } finally {
      setUdiLooking(false);
    }
  }

  function resetForm() {
    setSku(""); setName(""); setManufacturerId(""); setCategoryId("");
    setDescription(""); setModelNumber(""); setRegulatoryStatus("pending");
    setError(""); setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.devices.create({
        sku:              sku.trim(),
        name:             name.trim(),
        manufacturerId,
        categoryId,
        description:      description.trim() || undefined,
        modelNumber:      modelNumber.trim()  || undefined,
        regulatoryStatus,
      });
      setSuccess(true);
      resetForm();
      startT(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add device.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSuccess(false); setError(""); }}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Add New Device</p>
            <p className="text-xs text-gray-400">Submit a device for pre-approval indexing</p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {/* Accordion body */}
      {open && (
        <div className="border-t border-gray-100 p-5">
          {success ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 flex items-start gap-3">
              <svg className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Device submitted successfully</p>
                <p className="text-xs text-emerald-700 mt-0.5">It will appear in the pending approvals queue below.</p>
                <button
                  onClick={() => { setSuccess(false); setOpen(false); }}
                  className="mt-2 text-xs font-medium text-emerald-700 underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── UDI Lookup (optional) ─────────────────────────────────── */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5ZM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
                  </svg>
                  UDI Auto-fill (optional)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={udi}
                    onChange={e => setUdi(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleUdiLookup())}
                    placeholder="Scan or paste UDI barcode…"
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleUdiLookup}
                    disabled={!udi.trim() || udiLooking}
                    className="btn btn-secondary whitespace-nowrap"
                  >
                    {udiLooking ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : "Look up"}
                  </button>
                </div>

                {udiError && (
                  <p className="mt-2 text-xs text-red-600">{udiError}</p>
                )}

                {udiResult && (
                  <div className="mt-2 rounded-lg bg-white border border-indigo-200 px-3 py-2 text-xs space-y-0.5">
                    <p className="font-semibold text-gray-800">{udiResult.brandName ?? udiResult.deviceDescription}</p>
                    {udiResult.companyName && (
                      <p className="text-gray-500">Manufacturer: {udiResult.companyName}</p>
                    )}
                    {udiResult.versionModelNumber && (
                      <p className="text-gray-500">Model: {udiResult.versionModelNumber}</p>
                    )}
                    <p className="text-emerald-600 font-medium mt-1">
                      ✓ Fields auto-filled from GUDID — review before submitting
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* SKU */}
                <div>
                  <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                    SKU <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="sku"
                    type="text"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="e.g. ZIM-KNEE-001"
                    maxLength={100}
                    required
                    className="input"
                  />
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="dev-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Device Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="dev-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Nexgen Knee System"
                    maxLength={300}
                    required
                    className="input"
                  />
                </div>

                {/* Manufacturer */}
                <div>
                  <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturer <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="manufacturer"
                    value={manufacturerId}
                    onChange={e => setManufacturerId(e.target.value)}
                    required
                    className="input"
                  >
                    <option value="">— Select manufacturer —</option>
                    {manufacturers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    required
                    className="input"
                  >
                    <option value="">— Select category —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Model Number */}
                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                  <input
                    id="model"
                    type="text"
                    value={modelNumber}
                    onChange={e => setModelNumber(e.target.value)}
                    placeholder="e.g. NKS-2024-A"
                    maxLength={100}
                    className="input"
                  />
                </div>

                {/* Regulatory Status */}
                <div>
                  <label htmlFor="reg-status" className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Regulatory Status
                  </label>
                  <select
                    id="reg-status"
                    value={regulatoryStatus}
                    onChange={e => setRegulatoryStatus(e.target.value as typeof REG_STATUSES[number])}
                    className="input"
                  >
                    {REG_STATUSES.map(s => (
                      <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="desc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  id="desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Clinical description, intended use, key features…"
                  rows={3}
                  maxLength={5000}
                  className="input resize-none"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">
                  Device will be added with <span className="font-medium text-gray-600">pending</span> approval status.
                </p>
                <button
                  type="submit"
                  disabled={!formValid || submitting}
                  className="btn btn-primary"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                      </svg>
                      Adding…
                    </span>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add Device
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
