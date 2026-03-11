"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── SVG icon set ─────────────────────────────────────────────────────────
   Inline SVGs keep the bundle lean (no icon library dependency) and allow
   per-icon aria-hidden so screen readers skip decorative graphics.
   Source shapes: Heroicons v2 (MIT licence).
────────────────────────────────────────────────────────────────────────── */
const Icon = {
  HardwareIndex: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
    </svg>
  ),
  PeerTelemetry: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Z" />
      <path d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625Z" />
      <path d="M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  SafetyAlerts: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
  Admin: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  SignOut: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  ),
};

const navItems = [
  {
    href:      "/dashboard/devices",
    label:     "Hardware Index",
    Icon:      Icon.HardwareIndex,
    adminOnly: false,
  },
  {
    href:      "/dashboard/annotations",
    label:     "Peer Telemetry",
    Icon:      Icon.PeerTelemetry,
    adminOnly: false,
  },
  {
    href:      "/dashboard/alerts",
    label:     "Safety Alerts",
    Icon:      Icon.SafetyAlerts,
    adminOnly: false,
  },
  {
    href:      "/dashboard/admin",
    label:     "Admin",
    Icon:      Icon.Admin,
    adminOnly: true,
  },
];

/* ─── Role display helpers ─────────────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  surgeon:                 "Surgeon",
  hospital_safety_officer: "Safety Officer",
  system_admin:            "System Admin",
  it_procurement:          "IT Procurement",
};

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Component ────────────────────────────────────────────────────────────── */
interface SidebarNavProps {
  user: {
    name?:    string;
    email?:   string;
    picture?: string | null;
    "https://logiqo.io/role"?: string;
  };
}

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const role     = user["https://logiqo.io/role"];
  const isAdmin  = role === "hospital_safety_officer" || role === "system_admin";
  const initials = getInitials(user.name);
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : "Guest";

  return (
    /* Dark sidebar — better contrast vs bright content area (Refactoring UI: use
       color to establish visual hierarchy between chrome and content) */
    <nav
      aria-label="Main navigation"
      className="flex h-full w-64 shrink-0 flex-col"
      style={{ background: "rgb(15 15 26)", borderRight: "1px solid rgb(30 30 50)" }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-2.5 px-5 shrink-0"
           style={{ borderBottom: "1px solid rgb(30 30 50)" }}>
        {/* Medical cross mark */}
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgb(79 70 229)" }}
        >
          <svg viewBox="0 0 20 20" fill="white" className="h-4 w-4">
            <path d="M12 3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h3a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-3V3Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-none text-white tracking-tight">LogiQo</p>
          <p className="mt-0.5 text-2xs font-medium text-indigo-400 uppercase tracking-widest">MedTech</p>
        </div>
      </div>

      {/* ── Nav section label ─────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-1.5">
        <p className="text-2xs font-semibold uppercase tracking-widest"
           style={{ color: "rgb(100 110 160)" }}>
          Platform
        </p>
      </div>

      {/* ── Nav links ─────────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-0.5 px-3 overflow-y-auto scrollbar-thin">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                /* aria-current="page" is the correct attribute for the active nav link
                   (Inclusive Components: Navigation pattern) */
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5",
                  "text-sm font-medium transition-all duration-100",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {/* Active indicator bar */}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute left-0 ml-1 h-6 w-1 rounded-r-full bg-brand-500",
                    "transition-opacity duration-100",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30",
                  ].join(" ")}
                  style={{ position: "absolute" }}
                />
                <item.Icon />
                {item.label}
              </Link>
            );
          })}
      </div>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className="shrink-0 p-3" style={{ borderTop: "1px solid rgb(30 30 50)" }}>
        <div className="flex items-center gap-3 rounded-lg p-2.5">
          {/* Avatar — image with initials fallback (Inclusive Components: graceful degradation) */}
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name ?? "User avatar"}
              className="h-9 w-9 shrink-0 rounded-full ring-2"
              style={{ outline: "2px solid rgb(30 30 50)", outlineOffset: "0px" }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                         bg-indigo-600 text-xs font-bold text-white select-none"
            >
              {initials}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white leading-tight">
              {user.name ?? user.email ?? "User"}
            </p>
            <p className="truncate text-2xs font-medium mt-0.5" style={{ color: "rgb(130 140 200)" }}>
              {roleLabel}
            </p>
          </div>
        </div>

        {/* Sign out — use a full button with icon for better affordance */}
        <Link
          href="/api/auth/logout"
          className="mt-1 flex w-full items-center justify-center gap-2
                     rounded-lg px-3 py-2
                     text-xs font-medium
                     text-slate-500 hover:bg-white/5 hover:text-slate-300
                     transition-colors duration-100"
        >
          <Icon.SignOut />
          Sign out
        </Link>
      </div>
    </nav>
  );
}
