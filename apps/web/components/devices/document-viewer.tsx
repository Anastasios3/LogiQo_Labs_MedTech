"use client";

/**
 * DocumentViewer — per-document "Open" button that fetches a pre-signed S3 URL
 * on demand and renders the PDF / file inside an accessible modal.
 *
 * Design decisions:
 *   - URLs are fetched lazily (on click), not pre-fetched, to avoid wasting the
 *     15-minute TTL window on documents the user may never open.
 *   - One loading spinner per document (keyed by documentId) so opening one
 *     document does not disable all other buttons.
 *   - Accessible modal: role="dialog", aria-modal, Esc-to-close, scroll-lock.
 *   - Click-outside closes: transparent backdrop div behind the panel.
 *   - The <iframe> has both src and title for screen readers.
 *
 * Pre-signed URL expiry handling:
 *   S3 pre-signed URLs expire after a finite TTL. When they expire S3 returns an
 *   HTTP 403 with an AccessDenied XML body — the browser treats this as a
 *   *successful* load (not a network error) so iframe.onError never fires.
 *   Instead we use the `expiresAt` timestamp returned by the API to schedule a
 *   client-side warning precisely at the moment the URL becomes invalid. At that
 *   point an overlay replaces the iframe content with a "Session expired — Reload"
 *   prompt. Clicking Reload re-fetches a fresh pre-signed URL and replaces the
 *   iframe src without closing/reopening the modal.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocMeta {
  id:             string;
  title:          string;
  documentType:   string;
  version?:       string | null;
  mimeType?:      string | null;
  fileSizeBytes?: number | null;
}

interface DocumentViewerProps {
  deviceId:  string;
  documents: DocMeta[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCTYPE_LABELS: Record<string, string> = {
  ifu:            "IFU",
  spec_sheet:     "Spec Sheet",
  safety_notice:  "Safety Notice",
  approval_cert:  "Approval Certificate",
  labeling:       "Labeling",
  other:          "Other",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentViewer({ deviceId, documents }: DocumentViewerProps) {
  // Currently-open document
  const [openUrl,       setOpenUrl]       = useState<string | null>(null);
  const [openTitle,     setOpenTitle]     = useState<string>("");
  const [openDocId,     setOpenDocId]     = useState<string | null>(null);
  const [openExpiresAt, setOpenExpiresAt] = useState<Date | null>(null);

  // Per-document loading / error state
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId,   setErrorId]   = useState<string | null>(null);

  // True once the pre-signed URL's TTL has elapsed
  const [urlExpired,    setUrlExpired]    = useState(false);
  // True while a background reload is in flight (after expiry prompt is clicked)
  const [reloading,     setReloading]     = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Open a document ──────────────────────────────────────────────────────

  const handleOpen = useCallback(async (doc: DocMeta) => {
    setLoadingId(doc.id);
    setErrorId(null);
    setUrlExpired(false);
    try {
      const { url, expiresAt } = await apiClient.devices.getDocumentUrl(deviceId, doc.id);
      setOpenDocId(doc.id);
      setOpenTitle(doc.title);
      setOpenExpiresAt(new Date(expiresAt));
      setOpenUrl(url);           // set URL last so expiry timer starts with correct ref
    } catch {
      setErrorId(doc.id);
    } finally {
      setLoadingId(null);
    }
  }, [deviceId]);

  // ── Reload after expiry ──────────────────────────────────────────────────

  const handleReload = useCallback(async () => {
    if (!openDocId) return;
    const doc = documents.find((d) => d.id === openDocId);
    if (!doc) return;
    setReloading(true);
    setUrlExpired(false);
    try {
      const { url, expiresAt } = await apiClient.devices.getDocumentUrl(deviceId, openDocId);
      setOpenExpiresAt(new Date(expiresAt));
      setOpenUrl(url);
    } catch {
      // Restore expired state so the user can try again
      setUrlExpired(true);
    } finally {
      setReloading(false);
    }
  }, [deviceId, openDocId, documents]);

  // ── Close modal ──────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setOpenUrl(null);
    setOpenTitle("");
    setOpenDocId(null);
    setOpenExpiresAt(null);
    setUrlExpired(false);
    setReloading(false);
  }, []);

  // ── Expiry timer ─────────────────────────────────────────────────────────
  //
  // Schedule setUrlExpired(true) to fire exactly when the pre-signed URL
  // expires. Uses openUrl as the dep so the timer resets whenever a fresh
  // URL is loaded (initial open or after reload).
  //
  // If expiresAt is already in the past (edge case: slow network), mark
  // immediately. If expiresAt is not provided (should not happen with our
  // API), skip — the URL may still expire but we cannot warn accurately.

  useEffect(() => {
    if (!openUrl || !openExpiresAt) return;

    const msUntilExpiry = openExpiresAt.getTime() - Date.now();

    if (msUntilExpiry <= 0) {
      setUrlExpired(true);
      return;
    }

    const timer = setTimeout(() => setUrlExpired(true), msUntilExpiry);
    return () => clearTimeout(timer);
  }, [openUrl, openExpiresAt]);

  // ── Keyboard and scroll effects ──────────────────────────────────────────

  useEffect(() => {
    if (!openUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openUrl, handleClose]);

  useEffect(() => {
    document.body.style.overflow = openUrl ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [openUrl]);

  // ── Early return ─────────────────────────────────────────────────────────

  if (!documents || documents.length === 0) return null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Documents
        </h3>

        <ul className="space-y-2" aria-label="Device documents">
          {documents.map((doc) => {
            const isLoading = loadingId === doc.id;
            const hasError  = errorId   === doc.id;
            const label     = DOCTYPE_LABELS[doc.documentType] ?? doc.documentType.replace(/_/g, " ");

            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                {/* Doc info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{doc.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-gray-400 capitalize">{label}</span>
                    {doc.version && (
                      <>
                        <span className="text-xs text-gray-300" aria-hidden="true">·</span>
                        <span className="font-mono text-xs text-gray-400">v{doc.version}</span>
                      </>
                    )}
                    {doc.fileSizeBytes && doc.fileSizeBytes > 0 && (
                      <>
                        <span className="text-xs text-gray-300" aria-hidden="true">·</span>
                        <span className="text-xs text-gray-400">{formatBytes(doc.fileSizeBytes)}</span>
                      </>
                    )}
                  </div>
                  {hasError && (
                    <p className="mt-1 text-xs text-red-500" role="alert">
                      Failed to load — please try again.
                    </p>
                  )}
                </div>

                {/* Open button */}
                <button
                  type="button"
                  onClick={() => handleOpen(doc)}
                  disabled={isLoading}
                  aria-label={`Open ${doc.title}`}
                  aria-busy={isLoading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                >
                  {isLoading ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  )}
                  {isLoading ? "Loading…" : "Open"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── PDF Modal ───────────────────────────────────────────────────────── */}
      {openUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Document: ${openTitle}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop — click to close */}
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5"
            style={{ height: "82vh" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <h2 className="truncate text-sm font-semibold text-gray-900">{openTitle}</h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Open in new tab — always available even after expiry */}
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600"
                  aria-label="Open document in a new tab"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  New tab
                </a>

                {/* Close */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close document viewer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/*
              iframe container — positioned relative so the expiry overlay can
              sit on top of it (position: absolute, inset-0) without shifting layout.
            */}
            <div className="relative flex-1 overflow-hidden">
              <iframe
                src={openUrl}
                title={openTitle}
                className="h-full w-full border-0"
                allow="fullscreen"
              />

              {/*
                Expiry overlay — rendered when the pre-signed URL TTL elapses.

                Why not iframe.onError?
                  S3 returns HTTP 403 + AccessDenied XML for expired URLs. The
                  browser treats this as a *successful* load (valid HTTP response),
                  so onError never fires. We schedule this overlay instead using
                  the expiresAt timestamp from the API response.

                The overlay preserves the modal so the user does not lose their
                context — they just click "Reload" to get a fresh URL without
                closing and reopening.
              */}
              {urlExpired && (
                <div
                  role="status"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
                    <svg className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">
                      Document session expired
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-gray-500">
                      The secure link for this document has expired. Generate a fresh
                      link to continue viewing.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleReload}
                    disabled={reloading}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {reloading ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    )}
                    {reloading ? "Refreshing link…" : "Reload document"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
