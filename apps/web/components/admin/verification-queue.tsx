"use client";

import { useState, useTransition } from "react";
import { apiClient } from "@/lib/api-client";
import type { User } from "@logiqo/shared";

const TIER_CONFIG: Record<number, { label: string; badge: string; description: string }> = {
  0: { label: "Unverified",     badge: "bg-gray-100 text-gray-600 border-gray-200",        description: "Read-only access" },
  1: { label: "Domain Verified", badge: "bg-blue-100 text-blue-700 border-blue-200",        description: "Can flag content" },
  2: { label: "NPI Verified",    badge: "bg-emerald-100 text-emerald-700 border-emerald-200", description: "Full participation (1.0× vote)" },
  3: { label: "Trusted",         badge: "bg-violet-100 text-violet-700 border-violet-200",  description: "1.5× vote weight" },
};

function TierSelect({
  userId,
  currentTier,
  onUpdate,
}: {
  userId: string;
  currentTier: number;
  onUpdate: (userId: string, newTier: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTier = parseInt(e.target.value, 10) as 0 | 1 | 2 | 3;
    setError(null);
    startTransition(async () => {
      try {
        await apiClient.admin.setUserTier(userId, newTier, "Manual admin promotion");
        onUpdate(userId, newTier);
      } catch (err: any) {
        setError(err.message ?? "Failed to update tier");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={currentTier}
        onChange={handleChange}
        disabled={pending}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-60"
        aria-label="Set verification tier"
      >
        {[0, 1, 2, 3].map(t => (
          <option key={t} value={t}>
            Tier {t} — {TIER_CONFIG[t].label}
          </option>
        ))}
      </select>
      {error && <p className="text-2xs text-red-600">{error}</p>}
      {pending && <p className="text-2xs text-gray-400">Saving…</p>}
    </div>
  );
}

export function VerificationQueue({
  initialUsers,
}: {
  initialUsers: (User & { userReputation?: { totalScore: number; weeklyScore: number } | null })[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<number | "all">("all");

  const handleTierUpdate = (userId: string, newTier: number) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, verificationTier: newTier as any } : u));
  };

  const filtered = filter === "all" ? users : users.filter(u => u.verificationTier === filter);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">Verification Queue</h2>
          <p className="mt-0.5 text-xs text-gray-500">Manage user verification tiers across all tenants</p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${filter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            All
          </button>
          {[0, 1, 2, 3].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${filter === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              T{t}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No users in this tier.</div>
        )}

        {filtered.map(user => {
          const tierConf = TIER_CONFIG[user.verificationTier] ?? TIER_CONFIG[0];
          const rep = (user as any).userReputation;
          return (
            <div key={user.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{user.fullName}</span>
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium ${tierConf.badge}`}>
                      {tierConf.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{user.email}</span>
                    <span>·</span>
                    <span className="capitalize">{user.role.replace(/_/g, " ")}</span>
                    {user.specialty && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{user.specialty.replace(/_/g, " ")}</span>
                      </>
                    )}
                    {user.npiNumber && (
                      <>
                        <span>·</span>
                        <code className="font-mono text-xs">NPI {user.npiNumber}</code>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Reputation */}
              {rep && (
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">{rep.totalScore.toFixed(1)}</p>
                  <p className="text-2xs text-gray-400">rep. score</p>
                </div>
              )}

              {/* Tier selector */}
              <TierSelect
                userId={user.id}
                currentTier={user.verificationTier}
                onUpdate={handleTierUpdate}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
