"use client";

/**
 * NewAnnotationPage — 3-step annotation submission wizard.
 *
 * Step 1: Device selector (live search with 300ms debounce)
 * Step 2: Annotation details (type, severity, title, body, procedure meta)
 * Step 3: Visibility + preview + submit
 *
 * Validation:
 *   Zod schema from @logiqo/shared (createAnnotationSchema) with client-side
 *   overrides: body min 50 chars (stricter than API's 20), max 2000 chars.
 *   Per-field inline errors shown on the step where the field lives.
 *
 * Success:
 *   toast.success() fires, then router.push() to the device detail page.
 *   The toast persists across the navigation thanks to the Zustand store.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams }  from "next/navigation";
import { z }                           from "zod";
import { createAnnotationSchema }      from "@logiqo/shared";
import { apiClient }                   from "@/lib/api-client";
import { useToast }                    from "@/components/ui/toast";
import type { Device }                 from "@logiqo/shared";

/* ─── Client-side schema (stricter body length than API default) ────────── */

const clientSchema = createAnnotationSchema.extend({
  body: z
    .string()
    .min(50,  "Description must be at least 50 characters")
    .max(2000, "Description must be 2000 characters or fewer")
    .trim(),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof clientSchema>, string>>;

/* ─── Constants ─────────────────────────────────────────────────────────── */

const ANNOTATION_TYPES = [
  { value: "operational_friction", label: "Operational Friction", desc: "Difficulty during routine use"             },
  { value: "failure_mode",         label: "Failure Mode",         desc: "Device failure observed in use"           },
  { value: "material_tolerance",   label: "Material Tolerance",   desc: "Material degradation or incompatibility"  },
  { value: "tooling_anomaly",      label: "Tooling Anomaly",      desc: "Issue with associated tooling"            },
  { value: "general_observation",  label: "General Observation",  desc: "Other clinical observation"               },
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

const BODY_MIN = 50;
const BODY_MAX = 2000;

/* ─── Step indicator ────────────────────────────────────────────────────── */

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n       = i + 1;
        const done    = n < step;
        const current = n === step;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                done    ? "bg-indigo-600 text-white"                        :
                current ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
                          "bg-gray-100 text-gray-400",
              ].join(" ")}
            >
              {done ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
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

/* ─── Inline field error ────────────────────────────────────────────────── */

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600" role="alert">
      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      {msg}
    </p>
  );
}

/* ─── Device search (Step 1) ────────────────────────────────────────────── */

function DeviceSelector({
  selected,
  onSelect,
}: {
  selected: Device | null;
  onSelect: (d: Device | null) => void;
}) {
  const [q,       setQ]       = useState("");
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
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border-2 border-indigo-400 bg-indigo-50 p-4">
        <div>
          <p className="font-semibold text-gray-900">{selected.name}</p>
          <p className="font-mono text-sm text-gray-500">{selected.sku}</p>
          {selected.manufacturer && (
            <p className="mt-0.5 text-xs text-gray-400">
              {(selected.manufacturer as { name: string }).name}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Clear device selection"
          onClick={() => { onSelect(null); setQ(""); setResults([]); }}
          className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
        {loading ? (
          <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
        aria-label="Search devices"
        aria-autocomplete="list"
        aria-controls={results.length > 0 ? "device-results" : undefined}
      />
      {results.length > 0 && (
        <ul
          id="device-results"
          role="listbox"
          aria-label="Device search results"
          className="absolute z-20 mt-1.5 w-full divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {results.map(d => (
            <li key={d.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => { onSelect(d); setQ(""); setResults([]); }}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-indigo-50"
              >
                <p className="text-sm font-medium text-gray-900">{d.name}</p>
                <p className="font-mono text-xs text-gray-400">{d.sku}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */

export default function NewAnnotationPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const toast        = useToast();

  const [step,          setStep]          = useState(1);
  const [device,        setDevice]        = useState<Device | null>(null);
  const [type,          setType]          = useState("");
  const [severity,      setSeverity]      = useState("");
  const [title,         setTitle]         = useState("");
  const [body,          setBody]          = useState("");
  const [procedureType, setProcedureType] = useState("");
  const [procedureDate, setProcedureDate] = useState("");
  const [patientCount,  setPatientCount]  = useState<number | "">(1);
  const [visibility,    setVisibility]    = useState<"tenant" | "platform">("tenant");
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState("");
  const [fieldErrors,   setFieldErrors]   = useState<FieldErrors>({});

  // Pre-select device from ?deviceId= URL param
  useEffect(() => {
    const did = searchParams.get("deviceId");
    if (!did) return;
    apiClient.devices.getById(did)
      .then(d => setDevice(d as unknown as Device))
      .catch(() => {});
  }, [searchParams]);

  // ── Step validity ──────────────────────────────────────────────────────────
  const step1Valid  = !!device;
  const trimmedBody = body.trim();
  const step2Valid  =
    !!type &&
    title.trim().length >= 1 &&
    trimmedBody.length >= BODY_MIN &&
    trimmedBody.length <= BODY_MAX;

  // ── Body counter helpers ───────────────────────────────────────────────────
  const bodyLen      = trimmedBody.length;
  const bodyUnderMin = bodyLen < BODY_MIN;
  const bodyOverMax  = bodyLen > BODY_MAX;

  function bodyCounterClass() {
    if (bodyOverMax)  return "text-red-600 font-semibold";
    if (bodyUnderMin) return "text-gray-400";
    return "text-emerald-600";
  }

  function bodyCounterText() {
    if (bodyOverMax)  return `${bodyLen - BODY_MAX} over limit`;
    if (bodyUnderMin) return `${BODY_MIN - bodyLen} more characters needed`;
    return `${bodyLen} / ${BODY_MAX}`;
  }

  // Clear a single field error when the user edits that field
  function clearErr(key: keyof FieldErrors) {
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!device || submitting) return;
    setSubmitError("");
    setFieldErrors({});

    // Client-side Zod validation
    const parsed = clientSchema.safeParse({
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

    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      // Jump back to the step that has the first validation error
      const step2Keys: Array<keyof FieldErrors> = [
        "annotationType", "title", "body", "procedureDate", "patientCount",
      ];
      if (step2Keys.some(k => errs[k]) && step === 3) setStep(2);
      return;
    }

    setSubmitting(true);
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

      toast.success(
        "Annotation submitted",
        `Your observation on "${device.name}" is now visible to verified colleagues.`,
      );
      router.push(`/dashboard/devices/${device.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <nav className="mb-2 text-xs text-gray-400" aria-label="Breadcrumb">
          <a href="/dashboard/annotations" className="transition-colors hover:text-gray-600">
            Peer Telemetry
          </a>
          <span className="mx-1.5" aria-hidden="true">›</span>
          <span className="text-gray-600">Submit Annotation</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Submit Peer Annotation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Share clinical observations with verified colleagues across the network.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <StepIndicator step={step} total={3} />

        {/* ── Step 1: Select Device ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Select Device</h2>
              <p className="mt-1 text-sm text-gray-500">
                Search for the implant or device you are annotating.
              </p>
            </div>
            <DeviceSelector selected={device} onSelect={setDevice} />
            <FieldError msg={fieldErrors.deviceId} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="btn btn-primary"
              >
                Continue
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Annotation Details ────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Annotation Details</h2>
              <p className="mt-1 text-sm text-gray-500">
                Annotating:{" "}
                <span className="font-medium text-gray-700">{device?.name}</span>
              </p>
            </div>

            {/* Annotation type */}
            <div>
              <p className="mb-2 block text-sm font-medium text-gray-700">
                Annotation Type <span aria-hidden="true">*</span>
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Annotation type">
                {ANNOTATION_TYPES.map(t => (
                  <label
                    key={t.value}
                    className={[
                      "flex cursor-pointer flex-col gap-0.5 rounded-lg border-2 p-3 transition-all",
                      type === t.value
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white hover:border-gray-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => { setType(t.value); clearErr("annotationType"); }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-900">{t.label}</span>
                    <span className="text-xs text-gray-400">{t.desc}</span>
                  </label>
                ))}
              </div>
              <FieldError msg={fieldErrors.annotationType} />
            </div>

            {/* Severity */}
            <div>
              <p className="mb-2 block text-sm font-medium text-gray-700">
                Severity{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Severity">
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
                    <span
                      className={[
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all",
                        severity === s.value
                          ? `${s.color} ring-2 ring-current ring-offset-1`
                          : "border-gray-200 text-gray-600 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="ann-title" className="mb-1 block text-sm font-medium text-gray-700">
                Title <span aria-hidden="true">*</span>
              </label>
              <input
                id="ann-title"
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); clearErr("title"); }}
                placeholder="Brief summary of the observation"
                maxLength={200}
                className={`input ${fieldErrors.title ? "border-red-400 focus:ring-red-300" : ""}`}
                aria-describedby={fieldErrors.title ? "title-err" : undefined}
                aria-invalid={!!fieldErrors.title}
              />
              <FieldError msg={fieldErrors.title} />
            </div>

            {/* Body */}
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label htmlFor="ann-body" className="text-sm font-medium text-gray-700">
                  Description <span aria-hidden="true">*</span>
                </label>
                <span
                  className={`text-xs tabular-nums ${bodyCounterClass()}`}
                  aria-live="polite"
                  aria-label={`Character count: ${bodyCounterText()}`}
                >
                  {bodyCounterText()}
                </span>
              </div>
              <textarea
                id="ann-body"
                value={body}
                onChange={e => { setBody(e.target.value); clearErr("body"); }}
                placeholder={`Describe the observation in clinical detail. Include context, conditions, and relevant factors. Minimum ${BODY_MIN} characters.`}
                rows={6}
                className={`input resize-none ${(fieldErrors.body || bodyOverMax) ? "border-red-400 focus:ring-red-300" : ""}`}
                aria-describedby={fieldErrors.body ? "body-err" : undefined}
                aria-invalid={!!fieldErrors.body || bodyOverMax}
              />
              <FieldError msg={fieldErrors.body} />
            </div>

            {/* Procedure metadata */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ann-procedure" className="mb-1 block text-sm font-medium text-gray-700">
                  Procedure Type
                </label>
                <select
                  id="ann-procedure"
                  value={procedureType}
                  onChange={e => setProcedureType(e.target.value)}
                  className="input"
                >
                  <option value="">— Select —</option>
                  {PROCEDURE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ann-date" className="mb-1 block text-sm font-medium text-gray-700">
                  Procedure Date
                </label>
                <input
                  id="ann-date"
                  type="date"
                  value={procedureDate}
                  onChange={e => { setProcedureDate(e.target.value); clearErr("procedureDate"); }}
                  max={new Date().toISOString().split("T")[0]}
                  className={`input ${fieldErrors.procedureDate ? "border-red-400" : ""}`}
                  aria-invalid={!!fieldErrors.procedureDate}
                />
                <FieldError msg={fieldErrors.procedureDate} />
              </div>
            </div>

            <div className="sm:w-1/2">
              <label htmlFor="ann-count" className="mb-1 block text-sm font-medium text-gray-700">
                Patient Count
              </label>
              <input
                id="ann-count"
                type="number"
                min={1}
                max={9999}
                value={patientCount}
                onChange={e => {
                  setPatientCount(e.target.value === "" ? "" : Number(e.target.value));
                  clearErr("patientCount");
                }}
                className={`input ${fieldErrors.patientCount ? "border-red-400" : ""}`}
                aria-invalid={!!fieldErrors.patientCount}
              />
              <p className="mt-1 text-xs text-gray-400">Aggregate count only — no PHI collected.</p>
              <FieldError msg={fieldErrors.patientCount} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="btn btn-primary"
              >
                Review
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Submit ────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Review &amp; Submit</h2>
              <p className="mt-1 text-sm text-gray-500">
                Annotations are immutable once submitted. Please review carefully.
              </p>
            </div>

            {/* Preview card */}
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
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
                <p className="mb-0.5 text-xs uppercase tracking-wide text-gray-400">Device</p>
                <p className="text-sm font-medium text-gray-900">{device?.name}</p>
              </div>
              <div>
                <p className="mb-0.5 text-xs uppercase tracking-wide text-gray-400">Title</p>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
              </div>
              <div>
                <p className="mb-0.5 text-xs uppercase tracking-wide text-gray-400">Description</p>
                <p className="text-sm leading-relaxed text-gray-700">{body.trim()}</p>
              </div>
              {(procedureType || procedureDate || patientCount !== "") && (
                <div className="flex flex-wrap gap-4 border-t border-gray-200 pt-3">
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
              <p className="mb-2 block text-sm font-medium text-gray-700">Visibility</p>
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {(["tenant", "platform"] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    aria-pressed={visibility === v}
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

            {/* API-level error */}
            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="btn btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary min-w-[160px]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
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
