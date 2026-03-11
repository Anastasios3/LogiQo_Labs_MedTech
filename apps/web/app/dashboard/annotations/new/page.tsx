"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type { Device } from "@logiqo/shared";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const ANNOTATION_TYPES = [
  { value: "operational_friction", label: "Operational Friction", desc: "Difficulty during routine use" },
  { value: "failure_mode",         label: "Failure Mode",         desc: "Device failure observed in use" },
  { value: "material_tolerance",   label: "Material Tolerance",   desc: "Material degradation or incompatibility" },
  { value: "tooling_anomaly",      label: "Tooling Anomaly",      desc: "Issue with associated tooling" },
  { value: "general_observation",  label: "General Observation",  desc: "Other clinical observation" },
] as const;

const SEVERITIES = [
  { value: "low",      label: "Low",      color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "medium",   label: "Medium",   color: "text-amber-700   bg-amber-50   border-amber-200"   },
  { value: "high",     label: "High",     color: "text-orange-700  bg-orange-50  border-orange-200"  },
  { value: "critical", label: "Critical", color: "text-red-700     bg-red-50     border-red-200"     },
] as const;

const PROCEDURE_TYPES = [
  "Hip Replacement",
  "Knee Replacement",
  "Shoulder Arthroplasty",
  "Spinal Fusion",
  "Cardiac Catheterization",
  "Laparoscopic Surgery",
  "Arthroscopy",
  "Other",
];

/* ─── Step indicator ────────────────────────────────────────────────────── */
function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done    = n < step;
        const current = n === step;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={[
              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
              done    ? "bg-indigo-600 text-white" :
              current ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
              "bg-gray-100 text-gray-400",
            ].join(" ")}>
              {done ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : n}
            </div>
            {i < total - 1 && (
              <div className={`h-0.5 w-12 rounded transition-all ${done ? "bg-indigo-600" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Device search (Step 1) ────────────────────────────────────────────── */
function DeviceSelector({ selected, onSelect }: {
  selected: Device | null;
  onSelect: (d: Device) => void;
}) {
  const [q, setQ]           = useState("");
  const [results, setResults] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.devices.list({ q, limit: 8 });
        setResults(res.data as unknown as Device[]);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 300);
  }, [q]);

  return (
    <div className="space-y-4">
      {selected ? (
        <div className="rounded-xl border-2 border-indigo-400 bg-indigo-50 p-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">{selected.name}</p>
            <p className="text-sm text-gray-500 font-mono">{selected.sku}</p>
            {selected.manufacturer && (
              <p className="text-xs text-gray-400 mt-0.5">{(selected.manufacturer as { name: string }).name}</p>
            )}
          </div>
          <button
            onClick={() => { onSelect(null as unknown as Device); setQ(""); setResults([]); }}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            {loading ? (
              <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
            ) : (
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by device name or SKU…"
            className="input pl-10"
            autoFocus
          />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-lg divide-y divide-gray-50 overflow-hidden">
              {results.map(d => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(d); setQ(""); setResults([]); }}
                    className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900 text-sm">{d.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{d.sku}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main form component ───────────────────────────────────────────────── */
export default function NewAnnotationPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [, startT]   = useTransition();

  // Pre-select device if ?deviceId=... in URL
  const [step, setStep]             = useState(1);
  const [device, setDevice]         = useState<Device | null>(null);
  const [type, setType]             = useState("");
  const [severity, setSeverity]     = useState("");
  const [title, setTitle]           = useState("");
  const [body, setBody]             = useState("");
  const [procedureType, setProcedureType] = useState("");
  const [procedureDate, setProcedureDate] = useState("");
  const [patientCount, setPatientCount]   = useState<number | "">(1);
  const [visibility, setVisibility]       = useState<"tenant" | "platform">("tenant");
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [error, setError]                 = useState("");

  // Load device from URL param
  useEffect(() => {
    const did = searchParams.get("deviceId");
    if (!did) return;
    apiClient.devices.getById(did).then(d => setDevice(d as unknown as Device)).catch(() => {});
  }, [searchParams]);

  // ── Step validation ─────────────────────────────────────────────────────
  const step1Valid = !!device;
  const step2Valid = !!type && !!title.trim() && body.trim().length >= 20;

  async function handleSubmit() {
    if (!device || !type || !title.trim() || body.trim().length < 20) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.annotations.create({
        deviceId:       device.id,
        annotationType: type,
        severity:       severity || undefined,
        title:          title.trim(),
        body:           body.trim(),
        procedureType:  procedureType || undefined,
        procedureDate:  procedureDate || undefined,
        patientCount:   patientCount !== "" ? Number(patientCount) : undefined,
        visibility,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Success screen ──────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Annotation Submitted</h2>
        <p className="text-gray-500 text-sm">
          Your peer annotation has been recorded and will be visible to other verified clinicians.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => startT(() => router.push("/dashboard/annotations"))}
            className="btn btn-primary"
          >
            View Feed
          </button>
          <button
            onClick={() => {
              setSubmitted(false); setStep(1); setDevice(null); setType(""); setSeverity("");
              setTitle(""); setBody(""); setProcedureType(""); setProcedureDate(""); setPatientCount(1);
              setVisibility("tenant");
            }}
            className="btn btn-secondary"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit Peer Annotation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Share clinical observations with verified colleagues across the network.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <StepIndicator step={step} total={3} />

        {/* ── Step 1: Select Device ────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Select Device</h2>
              <p className="text-sm text-gray-500 mt-1">Search for the implant or device you are annotating.</p>
            </div>
            <DeviceSelector selected={device} onSelect={setDevice} />
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="btn btn-primary"
              >
                Continue
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Annotation Details ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Annotation Details</h2>
              <p className="text-sm text-gray-500 mt-1">
                Annotating: <span className="font-medium text-gray-700">{device?.name}</span>
              </p>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Annotation Type *</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ANNOTATION_TYPES.map(t => (
                  <label
                    key={t.value}
                    className={[
                      "flex flex-col gap-0.5 rounded-lg border-2 p-3 cursor-pointer transition-all",
                      type === t.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300 bg-white",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => setType(t.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-900">{t.label}</span>
                    <span className="text-xs text-gray-400">{t.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map(s => (
                  <label key={s.value}>
                    <input
                      type="radio"
                      name="severity"
                      value={s.value}
                      checked={severity === s.value}
                      onChange={() => setSeverity(s.value)}
                      className="sr-only"
                    />
                    <span className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium cursor-pointer transition-all",
                      severity === s.value ? s.color + " ring-2 ring-offset-1 ring-current" : "border-gray-200 text-gray-600 hover:border-gray-300",
                    ].join(" ")}>
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief summary of the observation"
                maxLength={200}
                className="input"
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
                <span className={`ml-2 text-xs font-normal ${body.length < 20 ? "text-gray-400" : "text-emerald-600"}`}>
                  {body.length < 20 ? `${20 - body.length} more characters required` : "✓ minimum met"}
                </span>
              </label>
              <textarea
                id="body"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Describe the observation in detail. Include clinical context, conditions, and any relevant factors."
                rows={5}
                className="input resize-none"
              />
            </div>

            {/* Procedure info (2-col) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="procedure" className="block text-sm font-medium text-gray-700 mb-1">Procedure Type</label>
                <select id="procedure" value={procedureType} onChange={e => setProcedureType(e.target.value)} className="input">
                  <option value="">— Select —</option>
                  {PROCEDURE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Procedure Date</label>
                <input
                  id="date"
                  type="date"
                  value={procedureDate}
                  onChange={e => setProcedureDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="input"
                />
              </div>
            </div>

            <div className="sm:w-1/2">
              <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-1">Patient Count</label>
              <input
                id="count"
                type="number"
                min={1}
                max={9999}
                value={patientCount}
                onChange={e => setPatientCount(e.target.value === "" ? "" : Number(e.target.value))}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-400">Aggregate count only — no PHI collected.</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="btn btn-primary"
              >
                Review
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Submit ──────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Review & Submit</h2>
              <p className="text-sm text-gray-500 mt-1">
                Annotations are immutable once submitted. Please review carefully.
              </p>
            </div>

            {/* Preview card */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-info text-xs">
                  {ANNOTATION_TYPES.find(t => t.value === type)?.label}
                </span>
                {severity && (
                  <span className={`badge text-xs ${SEVERITIES.find(s => s.value === severity)?.color ?? ""}`}>
                    {severity}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Device</p>
                <p className="text-sm font-medium text-gray-900">{device?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Title</p>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
              </div>
              {(procedureType || procedureDate || patientCount !== "") && (
                <div className="flex flex-wrap gap-4 pt-1 border-t border-gray-200">
                  {procedureType && (
                    <div>
                      <p className="text-xs text-gray-400">Procedure</p>
                      <p className="text-sm text-gray-700">{procedureType}</p>
                    </div>
                  )}
                  {procedureDate && (
                    <div>
                      <p className="text-xs text-gray-400">Date</p>
                      <p className="text-sm text-gray-700">{procedureDate}</p>
                    </div>
                  )}
                  {patientCount !== "" && (
                    <div>
                      <p className="text-xs text-gray-400">Patients</p>
                      <p className="text-sm text-gray-700">{patientCount}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Visibility toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(["tenant", "platform"] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={[
                      "flex-1 py-2.5 text-sm font-medium transition-colors",
                      visibility === v
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {v === "tenant" ? "My Hospital Only" : "All Clinicians"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {visibility === "tenant"
                  ? "Visible only to verified colleagues at your institution."
                  : "Shared across the full peer network — all verified clinicians."}
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep(2)} className="btn btn-secondary" disabled={submitting}>
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary min-w-[140px]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Submitting…
                  </span>
                ) : "Submit Annotation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
