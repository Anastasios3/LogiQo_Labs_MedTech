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

const navItems = [
  { href: "/dashboard/devices",     label: "Hardware Index", Icon: Icon.HardwareIndex, adminOnly: false },
  { href: "/dashboard/annotations", label: "Peer Telemetry", Icon: Icon.PeerTelemetry, adminOnly: false },
  { href: "/dashboard/alerts",      label: "Safety Alerts",  Icon: Icon.SafetyAlerts,  adminOnly: false },
  { href: "/dashboard/admin",       label: "Admin",          Icon: Icon.Admin,          adminOnly: true  },
];

const ROLE_LABELS: Record<string, string> = {
  surgeon:                 "Surgeon",
  hospital_safety_officer: "Safety Officer",
  system_admin:            "System Admin",
  it_procurement:          "IT Procurement",
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
  const pathname = usePathname();
  const role     = user["https://logiqo.io/role"];
  const isAdmin  = role === "hospital_safety_officer" || role === "system_admin";
  const initials = getInitials(user.name);
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : "Guest";

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
      <div
        className="flex h-16 items-center shrink-0 overflow-hidden"
        style={{
          borderBottom: "1px solid rgb(30 30 50)",
          padding:      isCollapsed ? "0 0.75rem" : "0 1.25rem",
          gap:          isCollapsed ? 0 : "0.625rem",
          transition:   "padding 200ms ease-in-out, gap 200ms ease-in-out",
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
      </div>

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
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const isActive = pathname.startsWith(item.href);
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
