"use client";

import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { TenantDataSources, SyncFrequency, DataSourceSettings } from "@logiqo/shared";

// ── Types ──────────────────────────────────────────────────────────────────────

type SourceKey = keyof TenantDataSources;

interface SourceMeta {
  key:         SourceKey;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  badge?:      string;
  syncAction?: () => Promise<unknown>;
  testAction?: () => Promise<{ ok: boolean; message: string; requiresRegistration?: boolean }>;
}

const DEFAULT_SOURCES: TenantDataSources = {
  fdaRecalls: { enabled: true,  syncFrequency: "24h" },
  fda510k:    { enabled: true,  syncFrequency: "24h" },
  gudid:      { enabled: true,  syncFrequency: "manual" },
  eudamed:    { enabled: false, syncFrequency: "manual" },
};

const FREQ_LABELS: Record<SyncFrequency, string> = {
  manual: "Manual only",
  "1h":   "Every hour",
  "6h":   "Every 6 hours",
  "24h":  "Daily",
};

const FREQ_OPTIONS: SyncFrequency[] = ["manual", "1h", "6h", "24h"];

// ── Source metadata (icons + descriptions) ─────────────────────────────────────

function FdaIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}
function GudidIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5ZM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
    </svg>
  );
}
function EuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

interface Props {
  initialSettings: TenantDataSources | null;
}

type SyncState = "idle" | "running" | "done" | "error";

export function DataSourcesPanel({ initialSettings }: Props) {
  const [settings, setSettings] = useState<TenantDataSources>(
    initialSettings ?? DEFAULT_SOURCES
  );
  const [saving,      setSaving]   = useState<SourceKey | null>(null);
  const [syncState,   setSyncState] = useState<Record<string, SyncState>>({});
  const [syncMsg,     setSyncMsg]   = useState<Record<string, string>>({});

  const sources: SourceMeta[] = [
    {
      key:         "fdaRecalls",
      label:       "FDA Recalls",
      description: "Ingests FDA device recall notices (Class I–III) as Safety Alerts. Deduplicated by recall number.",
      badge:       "OpenFDA",
      icon:        <FdaIcon />,
      syncAction:  () => apiClient.ingestion.syncFdaRecalls(),
    },
    {
      key:         "fda510k",
      label:       "FDA 510(k) Clearances",
      description: "Enriches device records with FDA 510(k) clearance numbers and applicant data.",
      badge:       "OpenFDA",
      icon:        <FdaIcon />,
      syncAction:  () => apiClient.ingestion.syncFda510k(),
    },
    {
      key:         "gudid",
      label:       "GUDID (UDI Lookup)",
      description: "Real-time UDI barcode lookup via the FDA Global UDI Database. Used in the Add Device form.",
      badge:       "NLM",
      icon:        <GudidIcon />,
      testAction:  () => apiClient.ingestion.testGudid(),
    },
    {
      key:         "eudamed",
      label:       "EU EUDAMED",
      description: "EU device database. Connection test only in Phase 1 — full sync requires EU EUDAMED registration.",
      badge:       "EU",
      icon:        <EuIcon />,
      testAction:  () => apiClient.ingestion.testEudamed(),
    },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (key: SourceKey) => {
    const current = settings[key];
    const updated = { ...settings, [key]: { ...current, enabled: !current.enabled } };
    setSettings(updated);
    setSaving(key);
    try {
      const saved = await apiClient.settings.patch({ [key]: updated[key] });
      setSettings(saved);
    } catch {
      // Revert optimistic update
      setSettings(settings);
    } finally {
      setSaving(null);
    }
  }, [settings]);

  const handleFrequency = useCallback(async (key: SourceKey, freq: SyncFrequency) => {
    const updated = { ...settings, [key]: { ...settings[key], syncFrequency: freq } };
    setSettings(updated);
    setSaving(key);
    try {
      const saved = await apiClient.settings.patch({ [key]: updated[key] });
      setSettings(saved);
    } catch {
      setSettings(settings);
    } finally {
      setSaving(null);
    }
  }, [settings]);

  const handleSync = useCallback(async (source: SourceMeta) => {
    const key = source.key;
    setSyncState(s => ({ ...s, [key]: "running" }));
    setSyncMsg(m => ({ ...m, [key]: "" }));
    try {
      const action = source.syncAction ?? source.testAction;
      if (!action) return;
      const res = await action();
      const msg = (res as any).recordsIngested !== undefined
        ? `Done — ${(res as any).recordsIngested} ingested, ${(res as any).recordsSkipped} skipped`
        : (res as any).message ?? "Connection successful";
      setSyncState(s => ({ ...s, [key]: "done" }));
      setSyncMsg(m => ({ ...m, [key]: msg }));
    } catch (err) {
      setSyncState(s => ({ ...s, [key]: "error" }));
      setSyncMsg(m => ({ ...m, [key]: err instanceof Error ? err.message : "Sync failed" }));
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Data Source Integrations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Toggle sources on/off and configure how often they sync automatically.
          </p>
        </div>
        <span className="badge badge-info text-xs">4 sources</span>
      </div>

      {/* Source rows */}
      <div className="divide-y divide-gray-50">
        {sources.map((source) => {
          const cfg   = settings[source.key] as DataSourceSettings;
          const state = syncState[source.key] ?? "idle";
          const msg   = syncMsg[source.key] ?? "";
          const isSaving = saving === source.key;

          return (
            <div key={source.key} className="px-6 py-5">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={[
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  cfg.enabled
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-100 text-gray-400",
                ].join(" ")}>
                  {source.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{source.label}</span>
                    {source.badge && (
                      <span className="inline-flex items-center rounded-full bg-slate-100
                                       px-2 py-0.5 text-2xs font-medium text-slate-600">
                        {source.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    {source.description}
                  </p>

                  {/* Controls row */}
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {/* Frequency selector — only for enabled sources with sync */}
                    {cfg.enabled && (source.syncAction != null) && (
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor={`freq-${source.key}`}
                          className="text-xs font-medium text-gray-600 whitespace-nowrap"
                        >
                          Auto-sync:
                        </label>
                        <select
                          id={`freq-${source.key}`}
                          value={cfg.syncFrequency}
                          onChange={e => handleFrequency(source.key, e.target.value as SyncFrequency)}
                          disabled={isSaving}
                          className="input py-1 text-xs"
                          style={{ minWidth: "11rem" }}
                        >
                          {FREQ_OPTIONS.map(f => (
                            <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Sync / Test button */}
                    {cfg.enabled && (
                      <button
                        onClick={() => handleSync(source)}
                        disabled={state === "running"}
                        className="btn btn-secondary btn-sm flex items-center gap-1.5"
                      >
                        {state === "running" ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Running…
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            {source.syncAction ? "Sync now" : "Test connection"}
                          </>
                        )}
                      </button>
                    )}

                    {/* Sync result message */}
                    {msg && (
                      <span className={[
                        "text-xs font-medium",
                        state === "error" ? "text-red-600" : "text-emerald-600",
                      ].join(" ")}>
                        {state === "done" && "✓ "}
                        {state === "error" && "✗ "}
                        {msg}
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle */}
                <div className="shrink-0 flex items-center gap-2">
                  {isSaving && (
                    <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cfg.enabled}
                    aria-label={`${cfg.enabled ? "Disable" : "Enable"} ${source.label}`}
                    onClick={() => handleToggle(source.key)}
                    disabled={isSaving}
                    className={[
                      "relative inline-flex h-6 w-11 items-center rounded-full",
                      "transition-colors duration-200 focus:outline-none focus:ring-2",
                      "focus:ring-indigo-500 focus:ring-offset-2",
                      cfg.enabled ? "bg-indigo-600" : "bg-gray-200",
                      isSaving ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow",
                        "transition-transform duration-200",
                        cfg.enabled ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
