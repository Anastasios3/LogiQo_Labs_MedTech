"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

/* ─── SVG icon set ─────────────────────────────────────────────────────────
   Inline SVGs — no icon library dependency.  Source: Heroicons v2 (MIT).
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
  AuditLog: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  ),
  Organization: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  ),
  Settings: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  Moderation: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  ),
  SignOut: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
};

// visibility: "all" | "admin" | "orgAdmin"
//   "admin"    → hospital_safety_officer | system_admin
//   "orgAdmin" → org_admin | system_admin
const navItems = [
  { href: "/dashboard/devices",                label: "Hardware Index", Icon: Icon.HardwareIndex, visibility: "all"      },
  { href: "/dashboard/annotations",            label: "Peer Telemetry", Icon: Icon.PeerTelemetry, visibility: "all"      },
  { href: "/dashboard/alerts",                 label: "Safety Alerts",  Icon: Icon.SafetyAlerts,  visibility: "all"      },
  { href: "/dashboard/admin",                  label: "Admin",          Icon: Icon.Admin,          visibility: "admin"    },
  { href: "/dashboard/admin/audit-logs",       label: "Audit Log",      Icon: Icon.AuditLog,       visibility: "admin"    },
  { href: "/dashboard/admin/moderation",       label: "Moderation",     Icon: Icon.Moderation,     visibility: "admin"    },
  { href: "/dashboard/organizations",          label: "Organization",   Icon: Icon.Organization,   visibility: "orgAdmin" },
  { href: "/dashboard/settings",               label: "Settings",       Icon: Icon.Settings,       visibility: "admin"    },
] as const;

const ROLE_LABELS: Record<string, string> = {
  surgeon:                 "Surgeon",
  hospital_safety_officer: "Safety Officer",
  system_admin:            "System Admin",
  it_procurement:          "IT Procurement",
  org_admin:               "Org Admin",
};

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface SidebarNavProps {
  user: {
    name?:    string;
    email?:   string;
    picture?: string | null;
    "https://logiqo.io/role"?: string;
  };
}

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname   = usePathname();
  const role       = user["https://logiqo.io/role"];
  const isAdmin    = role === "hospital_safety_officer" || role === "system_admin";
  const isOrgAdmin = role === "org_admin" || role === "system_admin";
  const initials   = getInitials(user.name);
  const roleLabel  = role ? (ROLE_LABELS[role] ?? role) : "Guest";

  // ── Collapse state — persisted to localStorage ─────────────────────────────
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored === "true") setCollapsed(true);
    } catch {/* SSR / private browsing */}
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {/* ignore */}
      return next;
    });
  }, []);

  // Avoid hydration flash — render expanded until mounted
  const isCollapsed = mounted && collapsed;

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col shrink-0 overflow-hidden"
      style={{
        background:    "rgb(15 15 26)",
        borderRight:   "1px solid rgb(30 30 50)",
        width:         isCollapsed ? "4rem" : "16rem",
        transition:    "width 200ms ease-in-out",
        minWidth:      isCollapsed ? "4rem" : "16rem",
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <Link
        href="/dashboard/devices"
        aria-label="Go to dashboard"
        className="flex h-16 items-center shrink-0 overflow-hidden hover:opacity-80 transition-opacity duration-100"
        style={{
          borderBottom: "1px solid rgb(30 30 50)",
          padding:      isCollapsed ? "0 0.75rem" : "0 1.25rem",
          gap:          isCollapsed ? 0 : "0.625rem",
          transition:   "padding 200ms ease-in-out, gap 200ms ease-in-out, opacity 100ms ease-in-out",
        }}
      >
        {/* Logo mark — always visible */}
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center rounded-lg overflow-hidden"
          style={{ width: "2rem", height: "2rem", background: "rgb(15 15 26)", flexShrink: 0 }}
        >
          {/* Real LogiQo logo — white on dark sidebar */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logiqo-logo.svg"
            alt="LogiQo"
            width={28}
            height={28}
            style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
          />
        </span>

        {/* Wordmark — hidden when collapsed */}
        <div
          className="min-w-0 overflow-hidden"
          style={{
            opacity:    isCollapsed ? 0 : 1,
            width:      isCollapsed ? 0 : "auto",
            transition: "opacity 150ms ease-in-out, width 200ms ease-in-out",
            whiteSpace: "nowrap",
          }}
          aria-hidden={isCollapsed}
        >
          <p className="text-sm font-bold leading-none text-white tracking-tight">LogiQo</p>
          <p className="mt-0.5 text-2xs font-medium text-indigo-400 uppercase tracking-widest">MedTech</p>
        </div>
      </Link>

      {/* ── Nav section label ─────────────────────────────────────────────── */}
      {!isCollapsed && (
        <div className="px-5 pt-5 pb-1.5 overflow-hidden">
          <p className="text-2xs font-semibold uppercase tracking-widest whitespace-nowrap"
             style={{ color: "rgb(100 110 160)" }}>
            Platform
          </p>
        </div>
      )}

      {/* ── Nav links ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
        style={{
          padding:    isCollapsed ? "0.75rem 0.5rem" : "0.375rem 0.75rem",
          paddingTop: isCollapsed ? "1rem" : "0.375rem",
          transition: "padding 200ms ease-in-out",
        }}
      >
        <div className="space-y-0.5">
          {navItems
            .filter((item) => {
              if (item.visibility === "admin")    return isAdmin;
              if (item.visibility === "orgAdmin") return isOrgAdmin;
              return true;
            })
            .map((item) => {
              // For /dashboard/admin, only highlight if NOT on a deeper admin sub-route
              // that has its own nav entry.
              const isActive =
                item.href === "/dashboard/admin"
                  ? pathname === "/dashboard/admin" ||
                    (pathname.startsWith("/dashboard/admin/") &&
                      !pathname.startsWith("/dashboard/admin/moderation") &&
                      !pathname.startsWith("/dashboard/admin/audit-logs"))
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={isCollapsed ? item.label : undefined}
                  className={[
                    "group relative flex items-center rounded-lg",
                    "text-sm font-medium transition-all duration-100",
                    isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  {/* Active indicator bar */}
                  <span
                    aria-hidden="true"
                    className={[
                      "absolute left-0 ml-1 h-6 w-1 rounded-r-full bg-indigo-500",
                      "transition-opacity duration-100",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30",
                    ].join(" ")}
                  />
                  <item.Icon />
                  {/* Label — hidden when collapsed */}
                  {!isCollapsed && (
                    <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              );
            })}
        </div>
      </div>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 overflow-hidden"
        style={{
          borderTop: "1px solid rgb(30 30 50)",
          padding:   isCollapsed ? "0.75rem 0.5rem" : "0.75rem",
          transition: "padding 200ms ease-in-out",
        }}
      >
        {/* Avatar + info */}
        <div
          className="flex items-center rounded-lg"
          style={{
            gap:     isCollapsed ? 0 : "0.75rem",
            padding: "0.5rem 0.625rem",
            justifyContent: isCollapsed ? "center" : "flex-start",
          }}
        >
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name ?? "User avatar"}
              className="h-8 w-8 shrink-0 rounded-full"
              style={{ outline: "2px solid rgb(50 50 80)", outlineOffset: "0px" }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                         bg-indigo-600 text-xs font-bold text-white select-none"
            >
              {initials}
            </span>
          )}

          {/* Name + role — hidden when collapsed */}
          {!isCollapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-white leading-tight whitespace-nowrap">
                {user.name ?? user.email ?? "User"}
              </p>
              <p className="truncate text-2xs font-medium mt-0.5 whitespace-nowrap"
                 style={{ color: "rgb(130 140 200)" }}>
                {roleLabel}
              </p>
            </div>
          )}
        </div>

        {/* Sign out */}
        {!isCollapsed ? (
          <Link
            href="/api/auth/logout"
            className="mt-1 flex w-full items-center justify-center gap-2
                       rounded-lg px-3 py-1.5
                       text-xs font-medium
                       text-slate-500 hover:bg-white/5 hover:text-slate-300
                       transition-colors duration-100"
          >
            <Icon.SignOut />
            Sign out
          </Link>
        ) : (
          <Link
            href="/api/auth/logout"
            title="Sign out"
            className="mt-1 flex w-full items-center justify-center rounded-lg py-1.5
                       text-slate-500 hover:bg-white/5 hover:text-slate-300
                       transition-colors duration-100"
          >
            <Icon.SignOut />
          </Link>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5
                     text-slate-600 hover:bg-white/5 hover:text-slate-400
                     transition-colors duration-100"
        >
          <span
            style={{
              display:   "flex",
              transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease-in-out",
            }}
          >
            <Icon.ChevronLeft />
          </span>
          {!isCollapsed && (
            <span className="ml-2 text-xs font-medium whitespace-nowrap">Collapse</span>
          )}
        </button>
      </div>
    </nav>
  );
}
