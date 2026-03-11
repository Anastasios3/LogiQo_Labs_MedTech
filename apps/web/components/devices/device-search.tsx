"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition, useEffect, useRef, useId } from "react";

export interface DeviceMeta {
  manufacturers: { id: string; name: string; slug: string }[];
  categories:    { id: string; name: string; code: string }[];
}

interface DeviceSearchProps {
  initialQuery?:        string;
  initialStatus?:       string;
  initialCategory?:     string;
  initialManufacturer?: string;
  meta?:                DeviceMeta;
}

const STATUSES = [
  { value: "",           label: "All"       },
  { value: "approved",   label: "Approved"  },
  { value: "recalled",   label: "Recalled"  },
  { value: "pending",    label: "Pending"   },
  { value: "withdrawn",  label: "Withdrawn" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  approved:  "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-400",
  recalled:  "bg-red-50 text-red-700 border-red-200 ring-red-400",
  pending:   "bg-amber-50 text-amber-700 border-amber-200 ring-amber-400",
  withdrawn: "bg-gray-50 text-gray-700 border-gray-200 ring-gray-400",
};

const ACTIVE_DOT: Record<string, string> = {
  approved:  "bg-emerald-500",
  recalled:  "bg-red-500",
  pending:   "bg-amber-500",
  withdrawn: "bg-gray-400",
};

export function DeviceSearch({
  initialQuery        = "",
  initialStatus       = "",
  initialCategory     = "",
  initialManufacturer = "",
  meta,
}: DeviceSearchProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef  = useRef<HTMLInputElement>(null);
  const inputId   = useId();
  const statusId  = useId();
  const catId     = useId();
  const mfgId     = useId();

  // ── Keyboard shortcut: ⌘K / Ctrl+K focuses search ─────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Push URL with updated filters ─────────────────────────────────────────
  const navigate = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else   params.delete(k);
      });
      params.delete("page");
      startTransition(() => {
        router.replace(`/dashboard/devices?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const activeFilters: { key: string; label: string; value: string }[] = [];
  if (initialStatus)       activeFilters.push({ key: "status",       label: "Status",       value: STATUSES.find(s => s.value === initialStatus)?.label ?? initialStatus });
  if (initialCategory)     activeFilters.push({ key: "category",     label: "Category",     value: meta?.categories.find(c => c.id === initialCategory)?.name ?? initialCategory });
  if (initialManufacturer) activeFilters.push({ key: "manufacturer", label: "Manufacturer", value: meta?.manufacturers.find(m => m.slug === initialManufacturer)?.name ?? initialManufacturer });

  const hasActiveFilters = initialStatus || initialCategory || initialManufacturer;

  return (
    <div className="space-y-3">

      {/* ── Search input ─────────────────────────────────────────────────── */}
      <div>
        <label htmlFor={inputId} className="sr-only">Search devices</label>
        <div className="relative">
          {/* Search icon / spinner */}
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {isPending ? (
              <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </span>

          <input
            ref={inputRef}
            id={inputId}
            type="search"
            placeholder="Search by name, SKU, manufacturer, description…"
            defaultValue={initialQuery}
            onChange={(e) => navigate({ q: e.target.value })}
            aria-busy={isPending}
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-16 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />

          {/* ⌘K hint */}
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
            <kbd className="flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] text-gray-400">⌘</kbd>
            <kbd className="flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] text-gray-400">K</kbd>
          </div>
        </div>
      </div>

      {/* ── Filter row ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by regulatory status">
          {STATUSES.map(({ value, label }) => {
            const isActive = initialStatus === value;
            const dotClass = value ? ACTIVE_DOT[value] : "";
            return (
              <button
                key={value}
                type="button"
                onClick={() => navigate({ status: value })}
                aria-pressed={isActive}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-100",
                  isActive
                    ? (value ? `${STATUS_COLORS[value]} border ring-1 ring-offset-0` : "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-400")
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700",
                ].join(" ")}
              >
                {dotClass && (
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                )}
                {label}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div aria-hidden="true" className="h-5 w-px bg-gray-200 hidden sm:block" />

        {/* Category select */}
        {meta && meta.categories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label htmlFor={catId} className="sr-only">Category</label>
            <select
              id={catId}
              value={initialCategory}
              onChange={(e) => navigate({ category: e.target.value })}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer hover:border-gray-300"
            >
              <option value="">All Categories</option>
              {meta.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Manufacturer select */}
        {meta && meta.manufacturers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label htmlFor={mfgId} className="sr-only">Manufacturer</label>
            <select
              id={mfgId}
              value={initialManufacturer}
              onChange={(e) => navigate({ manufacturer: e.target.value })}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer hover:border-gray-300"
            >
              <option value="">All Manufacturers</option>
              {meta.manufacturers.map((m) => (
                <option key={m.id} value={m.slug}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <>
            <div aria-hidden="true" className="h-5 w-px bg-gray-200 hidden sm:block" />
            <button
              type="button"
              onClick={() => navigate({ status: "", category: "", manufacturer: "" })}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          </>
        )}
      </div>

      {/* ── Active filter chips ────────────────────────────────────────────── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          <span className="text-xs text-gray-400 font-medium">Filtering by:</span>
          {activeFilters.map(({ key, label, value }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              <span className="text-indigo-400">{label}:</span> {value}
              <button
                type="button"
                onClick={() => navigate({ [key]: "" })}
                aria-label={`Remove ${label} filter`}
                className="ml-0.5 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Screen reader live region */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? "Filtering…" : ""}
      </div>
    </div>
  );
}
