"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition, useId } from "react";

interface DeviceSearchProps {
  initialQuery?: string;
}

export function DeviceSearch({ initialQuery }: DeviceSearchProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputId = useId();  // stable ID for label association (Inclusive Components)

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set("q", term);
      } else {
        params.delete("q");
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`/dashboard/devices?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div>
      {/* Explicit label — Inclusive Components: form inputs always need a label */}
      <label htmlFor={inputId} className="label">
        Search devices
      </label>

      <div className="input-with-icon">
        {/* Icon container */}
        <span className="input-icon" aria-hidden="true">
          {isPending ? (
            /* Loading spinner during navigation transition */
            <svg
              className="h-4 w-4 animate-spin text-brand-500"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}
            >
              <path
                strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </span>

        <input
          id={inputId}
          type="search"
          placeholder="Search by device name, SKU, manufacturer, or category…"
          defaultValue={initialQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="input"
          /* aria-busy communicates loading state to screen readers while
             transition is in flight (Inclusive Components: live regions) */
          aria-busy={isPending}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Visually hidden status for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isPending ? "Searching…" : ""}
      </div>
    </div>
  );
}
