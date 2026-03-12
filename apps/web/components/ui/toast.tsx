"use client";

/**
 * Toast notification system — lightweight, no external dependencies.
 *
 * Architecture:
 *   - Zustand module-level store (same pattern as the rest of the codebase)
 *   - useToast() hook — call toast.success / toast.error / toast.info
 *   - <Toaster /> component — renders all active toasts; mount once in
 *     dashboard/layout.tsx (or any root layout wrapping the routes that need it)
 *
 * Behaviour:
 *   - Auto-dismiss after 4 seconds (configurable per call via duration param)
 *   - Manual dismiss via the × button
 *   - Toasts stack vertically at the top-right of the viewport
 *   - Survives client-side navigation because the Zustand store is module-level
 *     (not re-created on route change) — this lets us fire a toast, navigate
 *     away, and have it appear on the next page
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Device approved");
 *   toast.error("Action failed", "Please try again.");
 *   toast.info("Refreshing data…");
 */

import { useEffect, useCallback } from "react";
import { create } from "zustand";

// ── Store ─────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id:           string;
  variant:      ToastVariant;
  title:        string;
  description?: string;
  duration:     number; // ms
}

interface ToastStore {
  toasts: ToastItem[];
  add:    (toast: Omit<ToastItem, "id">) => string;
  remove: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// ── Public hook ───────────────────────────────────────────────────────────────

export function useToast() {
  const add = useToastStore((s) => s.add);

  return {
    success: (title: string, description?: string, duration = 4000) =>
      add({ variant: "success", title, description, duration }),
    error: (title: string, description?: string, duration = 5000) =>
      add({ variant: "error", title, description, duration }),
    info: (title: string, description?: string, duration = 4000) =>
      add({ variant: "info", title, description, duration }),
  } as const;
}

// ── Individual toast ──────────────────────────────────────────────────────────

const VARIANT_STYLES = {
  success: {
    outer:  "border-emerald-200 bg-emerald-50",
    icon:   "text-emerald-500",
    title:  "text-emerald-900",
    desc:   "text-emerald-700",
    close:  "text-emerald-400 hover:text-emerald-600",
  },
  error: {
    outer:  "border-red-200 bg-red-50",
    icon:   "text-red-500",
    title:  "text-red-900",
    desc:   "text-red-700",
    close:  "text-red-400 hover:text-red-600",
  },
  info: {
    outer:  "border-blue-200 bg-blue-50",
    icon:   "text-blue-500",
    title:  "text-blue-900",
    desc:   "text-blue-700",
    close:  "text-blue-400 hover:text-blue-600",
  },
} as const;

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    );
  }
  // info
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}

function SingleToast({
  toast,
  onDismiss,
}: {
  toast:     ToastItem;
  onDismiss: () => void;
}) {
  const styles = VARIANT_STYLES[toast.variant];

  // Auto-dismiss
  const dismiss = useCallback(onDismiss, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [dismiss, toast.duration]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={[
        "flex w-80 items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ring-1 ring-black/5",
        styles.outer,
      ].join(" ")}
    >
      <span className={`mt-0.5 ${styles.icon}`}>
        <ToastIcon variant={toast.variant} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-snug ${styles.title}`}>
          {toast.title}
        </p>
        {toast.description && (
          <p className={`mt-0.5 text-xs leading-relaxed ${styles.desc}`}>
            {toast.description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={`mt-0.5 shrink-0 rounded p-0.5 transition-opacity ${styles.close}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Toaster ───────────────────────────────────────────────────────────────────

/**
 * Mount <Toaster /> once near the root of the protected layout.
 * It renders all active toasts in a fixed overlay at the top-right.
 */
export function Toaster() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-end justify-start gap-2 px-4 py-5 sm:px-6"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <SingleToast toast={toast} onDismiss={() => remove(toast.id)} />
        </div>
      ))}
    </div>
  );
}
