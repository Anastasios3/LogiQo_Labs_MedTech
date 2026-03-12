"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { OrgUser, Invitation } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "surgeon",                  label: "Surgeon"          },
  { value: "hospital_safety_officer",  label: "Safety Officer"   },
  { value: "it_procurement",           label: "IT Procurement"   },
  { value: "org_admin",                label: "Org Admin"        },
] as const;

type OrgRole = (typeof ROLE_OPTIONS)[number]["value"];

const TIER_LABELS: Record<number, string> = {
  0: "Unverified",
  1: "Email verified",
  2: "NPI validated",
  3: "Trusted",
};

const TIER_BADGE: Record<number, string> = {
  0: "badge-inactive",
  1: "badge-info",
  2: "badge-approved",
  3: "badge bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200",
};

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [roleChanging, setRoleChanging]       = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn:  () => apiClient.organizations.listUsers({ limit: 100 }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.organizations.changeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      setRoleChanging(null);
      toast.success("Role updated");
    },
    onError: (err) => {
      toast.error("Failed to change role", err instanceof Error ? err.message : undefined);
      setRoleChanging(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => apiClient.organizations.removeUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      setConfirmRemoveId(null);
      toast.success("Member removed");
    },
    onError: (err) => {
      toast.error("Failed to remove member", err instanceof Error ? err.message : undefined);
    },
  });

  const users = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="card flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
        No active members found.
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Organisation members">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Verification</th>
                <th scope="col">Reputation</th>
                <th scope="col">Last login</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: OrgUser) => {
                const tier = user.verificationTier ?? 0;
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
                    </td>

                    <td>
                      {roleChanging === user.id ? (
                        <select
                          defaultValue={user.role}
                          className="input py-1 text-xs"
                          autoFocus
                          onBlur={() => setRoleChanging(null)}
                          onChange={(e) => {
                            changeRoleMutation.mutate({
                              userId: user.id,
                              role:   e.target.value,
                            });
                          }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          className="text-sm text-gray-700 hover:text-brand-600 hover:underline"
                          onClick={() => setRoleChanging(user.id)}
                          title="Click to change role"
                        >
                          {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
                        </button>
                      )}
                    </td>

                    <td>
                      <span className={TIER_BADGE[tier] ?? "badge"}>
                        {TIER_LABELS[tier] ?? `Tier ${tier}`}
                      </span>
                    </td>

                    <td className="tabular-nums text-sm text-gray-600">
                      {user.userReputation?.totalScore?.toLocaleString() ?? "—"}
                    </td>

                    <td className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString("en-US", {
                            month: "short",
                            day:   "numeric",
                            year:  "numeric",
                          })
                        : "Never"}
                    </td>

                    <td>
                      {confirmRemoveId === user.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-600 font-medium">Confirm remove?</span>
                          <button
                            onClick={() => removeMutation.mutate(user.id)}
                            disabled={removeMutation.isPending}
                            className="btn-danger text-xs px-2 py-1"
                          >
                            Yes, remove
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="btn-ghost text-xs px-2 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(user.id)}
                          className="btn-danger text-xs px-3 py-1.5"
                          aria-label={`Remove ${user.fullName}`}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">
            {users.length} active member{users.length !== 1 ? "s" : ""}
            {data?.total !== undefined && data.total > users.length && (
              <> · {data.total} total</>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

// ── Invitations tab ────────────────────────────────────────────────────────────

function InvitationsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail]   = useState("");
  const [role, setRole]     = useState<OrgRole>("surgeon");
  const [formError, setFormError] = useState<string | null>(null);
  const [lastSent, setLastSent]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["org-invitations"],
    queryFn:  () => apiClient.organizations.listInvitations(),
  });

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      apiClient.organizations.invite(body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
      setLastSent(res.email);
      setEmail("");
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Failed to send invitation.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.organizations.revokeInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
      toast.success("Invitation revoked");
    },
    onError: (err) => {
      toast.error("Failed to revoke invitation", err instanceof Error ? err.message : undefined);
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }
    setFormError(null);
    setLastSent(null);
    inviteMutation.mutate({ email: email.trim().toLowerCase(), role });
  };

  const invitations = data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Invite a new member</h3>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-52">
            <label className="label" htmlFor="invite-email">Email address</label>
            <input
              id="invite-email"
              type="email"
              required
              placeholder="surgeon@hospital.org"
              className="input"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
            />
          </div>

          <div className="w-44">
            <label className="label" htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="btn-primary whitespace-nowrap"
          >
            {inviteMutation.isPending ? "Sending…" : "Send invite"}
          </button>
        </form>

        {formError && (
          <p className="mt-3 text-sm text-red-600" role="alert">{formError}</p>
        )}

        {lastSent && !formError && (
          <p className="mt-3 text-sm text-emerald-600" role="status">
            Invitation sent to <strong>{lastSent}</strong>.
          </p>
        )}
      </div>

      {/* Pending invitations */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
          No pending invitations.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Pending invitations">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Invited by</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv: Invitation) => (
                  <tr key={inv.id}>
                    <td className="font-medium text-gray-900">{inv.email}</td>
                    <td className="text-sm text-gray-600">
                      {ROLE_OPTIONS.find((r) => r.value === inv.role)?.label ?? inv.role}
                    </td>
                    <td className="text-sm text-gray-500">
                      {inv.invitedBy?.fullName ?? "—"}
                    </td>
                    <td className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                      <time dateTime={inv.expiresAt}>
                        {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                          month: "short",
                          day:   "numeric",
                          year:  "numeric",
                        })}
                      </time>
                    </td>
                    <td>
                      <button
                        onClick={() => revokeMutation.mutate(inv.id)}
                        disabled={revokeMutation.isPending}
                        className="btn-danger text-xs px-3 py-1.5"
                        aria-label={`Revoke invitation for ${inv.email}`}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">
              {invitations.length} pending invitation{invitations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OrganizationManager ────────────────────────────────────────────────────────

type Tab = "members" | "invitations";

export function OrganizationManager() {
  const [tab, setTab] = useState<Tab>("members");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200" role="tablist">
        {(["members", "invitations"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            ].join(" ")}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "members"     && <UsersTab />}
      {tab === "invitations" && <InvitationsTab />}
    </div>
  );
}
