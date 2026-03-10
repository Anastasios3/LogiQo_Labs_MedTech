"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/dashboard/devices",
    label: "Hardware Index",
    icon: "🔬",
  },
  {
    href: "/dashboard/annotations",
    label: "Peer Telemetry",
    icon: "📋",
  },
  {
    href: "/dashboard/alerts",
    label: "Safety Alerts",
    icon: "⚠️",
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    icon: "🛡️",
    adminOnly: true,
  },
];

interface SidebarNavProps {
  user: {
    name?: string;
    email?: string;
    picture?: string;
    "https://logiqo.io/role"?: string;
  };
}

export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const role = user["https://logiqo.io/role"];
  const isAdmin =
    role === "hospital_safety_officer" || role === "system_admin";

  return (
    <nav className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <span className="text-xl font-bold text-brand-600">LogiQo</span>
        <span className="ml-1 text-xs text-gray-500">MedTech</span>
      </div>

      {/* Nav links */}
      <div className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
      </div>

      {/* User footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {user.picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name ?? "User"}
              className="h-8 w-8 rounded-full"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-gray-500">{role}</p>
          </div>
        </div>
        <Link
          href="/api/auth/logout"
          className="mt-3 block w-full rounded-md px-3 py-1.5 text-center text-xs text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Sign out
        </Link>
      </div>
    </nav>
  );
}
