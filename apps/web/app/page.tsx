import Link from "next/link";
import { apiClient } from "@/lib/api-client";

export const metadata = {
  title: "LogiQo MedTech — Unified Medical Hardware Platform",
};

async function getLandingStats() {
  try {
    return await apiClient.admin.stats();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const hasAuth0 = !!process.env.AUTH0_SECRET;
  const stats = await getLandingStats();

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── HERO — dark navy ─────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24"
        style={{ background: "linear-gradient(160deg, rgb(9 9 18) 0%, rgb(15 15 35) 50%, rgb(10 10 26) 100%)" }}
      >
        {/* Grid overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgb(99 102 241 / 0.04) 1px, transparent 1px), linear-gradient(to right, rgb(99 102 241 / 0.04) 1px, transparent 1px)`,
            backgroundSize:  "64px 64px",
          }}
        />
        {/* Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 40% at 50% 20%, rgb(99 102 241 / 0.15) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">

          {/* Phase chip */}
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5"
               style={{ borderColor: "rgb(99 102 241 / 0.3)", background: "rgb(99 102 241 / 0.08)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
              Phase 1 — Live Preview
            </span>
          </div>

          {/* Logo */}
          <div className="mb-8 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logiqo-logo.svg"
              alt="LogiQo"
              height={56}
              style={{ height: "56px", width: "auto", filter: "brightness(0) invert(1)" }}
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl leading-[1.08]">
            The OS for<br />
            <span style={{ background: "linear-gradient(90deg, #818cf8 0%, #6366f1 40%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Medical Devices
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "rgb(148 163 184)" }}>
            Manufacturer-agnostic hardware index. Peer-validated clinical telemetry.
            Hospital-grade compliance tooling — all in one platform built for the OR.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={hasAuth0 ? "/api/auth/login" : "/dashboard/devices"}
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "rgb(99 102 241)", boxShadow: "0 0 32px rgb(99 102 241 / 0.35)" }}
            >
              {hasAuth0 ? "Sign in" : "Enter Dashboard"}
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/dashboard/devices"
              className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold transition-all duration-150 hover:bg-white/5"
              style={{ borderColor: "rgb(99 102 241 / 0.4)", color: "rgb(199 210 254)" }}
            >
              Browse Hardware Index
            </Link>
          </div>

          {/* Live stats bar */}
          {stats && (
            <div className="mt-14 flex flex-wrap items-center justify-center gap-8 sm:gap-16">
              {[
                { value: stats.activeDevices,  label: "Indexed Devices"    },
                { value: stats.activeAlerts,   label: "Active Safety Alerts" },
                { value: stats.pendingDevices, label: "Awaiting Review"    },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="text-4xl font-bold text-white tabular-nums">{value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider" style={{ color: "rgb(100 116 139)" }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Dev mode notice */}
          {!hasAuth0 && (
            <p className="mt-10 text-xs" style={{ color: "rgb(71 85 105)" }}>
              <span className="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium"
                    style={{ borderColor: "rgb(99 102 241 / 0.3)", color: "rgb(129 140 248)", background: "rgb(99 102 241 / 0.08)" }}>
                ⚡ Dev mode
              </span>
              {" "}— Auth0 not configured. Set{" "}
              <code className="font-mono" style={{ color: "rgb(100 116 139)" }}>AUTH0_SECRET</code> to enable login.
            </p>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
             style={{ color: "rgb(71 85 105)" }}>
          <span className="text-xs uppercase tracking-widest">Explore</span>
          <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── FEATURE CARDS — light ────────────────────────────────────────────── */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-3">Platform Modules</p>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything the OR needs, unified
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              From device indexing to peer-validated telemetry — built for hospital safety officers, surgeons, and procurement teams.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href:    "/dashboard/devices",
                title:   "Hardware Index",
                desc:    "Manufacturer-agnostic index of 10,000+ implants. Full-text search, regulatory status, extraction tooling specs.",
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                  </svg>
                ),
                color: "text-indigo-600",
                bg:    "bg-indigo-50",
              },
              {
                href:  "/dashboard/annotations",
                title: "Peer Telemetry",
                desc:  "Clinician-reported observations. Failure modes, material tolerance findings, and technique tips — peer reviewed.",
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                ),
                color: "text-violet-600",
                bg:    "bg-violet-50",
              },
              {
                href:  "/dashboard/alerts",
                title: "Safety Alerts",
                desc:  "Real-time recalls, field corrections, and hazard notices. Acknowledge and track per-hospital compliance.",
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                ),
                color: "text-amber-600",
                bg:    "bg-amber-50",
              },
              {
                href:  "/dashboard/admin",
                title: "Admin & Audit",
                desc:  "Device approval pipeline, HIPAA-compliant immutable audit logs, and SOP document management.",
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                ),
                color: "text-emerald-600",
                bg:    "bg-emerald-50",
              },
            ].map(({ href, title, desc, icon, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5"
              >
                <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${color}`}>
                  {icon}
                </span>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 flex-1">{desc}</p>
                <span className={`mt-4 flex items-center gap-1 text-xs font-semibold ${color} group-hover:gap-2 transition-all`}>
                  Open
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST FOOTER ─────────────────────────────────────────────────────── */}
      <section className="bg-white border-t border-gray-100 px-6 py-14">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            Built for regulated environments
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                label: "HIPAA-Eligible",
                sub:   "BAA-ready architecture",
                icon: (
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                ),
              },
              {
                label: "GDPR Ready",
                sub:   "EU data residency support",
                icon: (
                  <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                ),
              },
              {
                label: "FDA MedWatch",
                sub:   "Phase 2 integration",
                icon: (
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
              },
              {
                label: "WCAG 2.1 AA",
                sub:   "Accessibility first",
                icon: (
                  <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                ),
              },
            ].map(({ label, sub, icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
                  {icon}
                </span>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
