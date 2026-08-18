"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getStaffUsers,
  inviteStaffUser,
  updateStaffUserRole,
  setStaffUserStatus,
  resendInvite,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  PERMISSION_MATRIX,
  BRANCHES,
  type StaffUser,
  type StaffRole,
  type StaffStatus,
} from "@/app/lib/security/users";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string | null) {
  if (!iso) return "Never signed in";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<StaffStatus, string> = {
  ACTIVE: "bg-[#0F2F26] text-[#F6F3EC]",
  INVITED: "bg-[#B98A3D] text-[#14231E]",
  SUSPENDED: "bg-[#8C4A2A]/10 text-[#8C4A2A] border border-[#8C4A2A]/30",
};

const STATUS_LABELS: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  SUSPENDED: "Suspended",
};

const ROLE_ORDER: StaffRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "LOAN_OFFICER",
  "TELLER",
  "AUDITOR",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = "users" | "roles";

export default function UsersRolesPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | StaffRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StaffStatus>("ALL");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getStaffUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        search.trim() === "" ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  async function handleRoleChange(userId: string, role: StaffRole) {
    setBusyUserId(userId);
    const prev = users;
    setUsers((cur) => cur.map((u) => (u.id === userId ? { ...u, role } : u)));
    try {
      await updateStaffUserRole(userId, role);
      setToast("Role updated.");
    } catch {
      setUsers(prev);
      setToast("Couldn't update role.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleStatusToggle(user: StaffUser) {
    const nextStatus: StaffStatus = user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setBusyUserId(user.id);
    const prev = users;
    setUsers((cur) => cur.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    try {
      await setStaffUserStatus(user.id, nextStatus);
      setToast(nextStatus === "SUSPENDED" ? "User suspended." : "User reactivated.");
    } catch {
      setUsers(prev);
      setToast("Couldn't update status.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleResend(userId: string) {
    setBusyUserId(userId);
    try {
      await resendInvite(userId);
      setToast("Invite resent.");
    } catch {
      setToast("Couldn't resend invite.");
    } finally {
      setBusyUserId(null);
    }
  }

  function handleInvited(user: StaffUser) {
    setUsers((cur) => [user, ...cur]);
    setInviteOpen(false);
    setToast("Invitation sent.");
  }

  return (
    <div className="min-h-screen bg-[#F6F3EC] text-[#14231E]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#0F2F26]/10 pb-6">
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8C6825]"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              SaccoFX Pro &middot; Tenant Settings
            </p>
            <h1
              className="mt-1 text-[28px] font-semibold text-[#0F2F26]"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              Users &amp; Roles
            </h1>
            <p className="mt-1.5 text-[14px] text-[#3D4F47]">
              Manage staff access to this SACCO. Visible to admins only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-[3px] bg-[#0F2F26] px-4 py-2.5 text-[14px] font-medium text-[#F6F3EC] transition-colors hover:bg-[#153D32]"
          >
            Invite user
          </button>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-[#D8CFBA]">
          <TabButton active={tab === "users"} onClick={() => setTab("users")}>
            Staff users
          </TabButton>
          <TabButton active={tab === "roles"} onClick={() => setTab("roles")}>
            Roles &amp; permissions
          </TabButton>
        </div>

        {tab === "users" ? (
          <>
            {/* Filters */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="min-w-[220px] flex-1 rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] placeholder:text-[#A9B5AE] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
              >
                <option value="ALL">All roles</option>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INVITED">Invited</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            {/* User table */}
            <div className="overflow-hidden rounded-[4px] border border-[#D8CFBA] bg-[#FFFDF8]">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-[#6B7F76]">
                  Loading staff users…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-[14px]">
                    <thead>
                      <tr className="border-b border-[#D8CFBA] text-left text-[11px] uppercase tracking-wide text-[#8A9A92]">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Branch</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Last active</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((user, idx) => (
                        <tr
                          key={user.id}
                          className={`border-b border-[#EFE9D8] last:border-b-0 ${
                            idx % 2 === 1 ? "bg-[#F6F3EC]/60" : ""
                          }`}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-[#0F2F26]">{user.name}</div>
                            <div className="text-[12.5px] text-[#6B7F76]">{user.email}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <select
                              value={user.role}
                              disabled={busyUserId === user.id || user.role === "SUPERADMIN"}
                              onChange={(e) =>
                                handleRoleChange(user.id, e.target.value as StaffRole)
                              }
                              className="rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-2 py-1.5 text-[13px] text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25 disabled:opacity-60"
                            >
                              {ROLE_ORDER.map((r) => (
                                <option key={r} value={r} disabled={r === "SUPERADMIN"}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 align-top text-[#3D4F47]">{user.branch}</td>
                          <td className="px-4 py-3 align-top">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[user.status]}`}
                            >
                              {STATUS_LABELS[user.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-[12.5px] text-[#6B7F76]">
                            {formatRelative(user.lastActiveAt)}
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="flex justify-end gap-3 text-[13px]">
                              {user.status === "INVITED" && (
                                <button
                                  type="button"
                                  disabled={busyUserId === user.id}
                                  onClick={() => handleResend(user.id)}
                                  className="font-medium text-[#0F2F26] hover:text-[#B98A3D] disabled:opacity-50"
                                >
                                  Resend
                                </button>
                              )}
                              {user.role !== "SUPERADMIN" && (
                                <button
                                  type="button"
                                  disabled={busyUserId === user.id}
                                  onClick={() => handleStatusToggle(user)}
                                  className={`font-medium disabled:opacity-50 ${
                                    user.status === "SUSPENDED"
                                      ? "text-[#2F6B4F] hover:text-[#0F2F26]"
                                      : "text-[#8C4A2A] hover:text-[#6b3620]"
                                  }`}
                                >
                                  {user.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-[#8A9A92]">
                            No users match this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <RolesPermissionsTable />
        )}
      </div>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onInvited={handleInvited} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[3px] border border-[#D8CFBA] bg-[#0F2F26] px-4 py-2.5 text-[13.5px] text-[#F6F3EC] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roles & permissions tab
// ---------------------------------------------------------------------------

function RolesPermissionsTable() {
  const levelStyle: Record<string, string> = {
    FULL: "bg-[#0F2F26] text-[#F6F3EC]",
    VIEW: "bg-[#B98A3D]/15 text-[#8C6825] border border-[#B98A3D]/40",
    NONE: "text-[#C7BFA9]",
  };
  const levelLabel: Record<string, string> = { FULL: "Full", VIEW: "View", NONE: "—" };

  return (
    <div className="space-y-6">
      {/* Role summaries */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLE_ORDER.map((role) => (
          <div key={role} className="rounded-[4px] border border-[#D8CFBA] bg-[#FFFDF8] p-4">
            <h3 className="text-[14.5px] font-semibold text-[#0F2F26]">{ROLE_LABELS[role]}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B7F76]">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="overflow-hidden rounded-[4px] border border-[#D8CFBA] bg-[#FFFDF8]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#D8CFBA] text-left text-[11px] uppercase tracking-wide text-[#8A9A92]">
                <th className="px-4 py-3 font-medium">Area</th>
                {ROLE_ORDER.map((role) => (
                  <th key={role} className="px-3 py-3 text-center font-medium">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((group, idx) => (
                <tr
                  key={group.key}
                  className={`border-b border-[#EFE9D8] last:border-b-0 ${
                    idx % 2 === 1 ? "bg-[#F6F3EC]/60" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-[#0F2F26]">{group.label}</td>
                  {ROLE_ORDER.map((role) => {
                    const level = group.levels[role];
                    return (
                      <td key={role} className="px-3 py-3 text-center">
                        <span
                          className={`inline-block min-w-[46px] rounded-full px-2 py-0.5 text-[11px] font-medium ${levelStyle[level]}`}
                        >
                          {levelLabel[level]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12.5px] text-[#8A9A92]">
        Roles are fixed system roles for now. Custom roles with configurable permissions aren't
        supported yet.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite modal
// ---------------------------------------------------------------------------

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (user: StaffUser) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("TELLER");
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstFieldRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await inviteStaffUser({ name, email, role, branch });
      onInvited(user);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div className="absolute inset-0 bg-[#0B241C]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-[4px] border border-[#D8CFBA] bg-[#FFFDF8] shadow-[0_24px_60px_-20px_rgba(11,36,28,0.5)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-[3px] text-[#6B7F76] transition-colors hover:bg-[#0F2F26]/[0.06] hover:text-[#0F2F26]"
        >
          ✕
        </button>

        <div className="px-6 pb-6 pt-7 sm:px-7">
          <span
            className="text-[11px] font-medium uppercase tracking-wide text-[#B98A3D]"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            Invite staff user
          </span>
          <h2
            id="invite-modal-title"
            className="mt-2 text-[20px] text-[#0F2F26]"
            style={{ fontFamily: "var(--font-serif, serif)", fontWeight: 600 }}
          >
            Add a new team member
          </h2>
          <p className="mt-1.5 text-[13.5px] text-[#3D4F47]">
            They'll receive an email invite to set up their account.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-[#0F2F26]">
                Full name
              </span>
              <input
                ref={firstFieldRef}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Wambui"
                className="w-full rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] placeholder:text-[#A9B5AE] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-[#0F2F26]">
                Work email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@amanisacco.co.ke"
                className="w-full rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] placeholder:text-[#A9B5AE] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0F2F26]">
                  Role
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
                >
                  {ROLE_ORDER.filter((r) => r !== "SUPERADMIN").map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0F2F26]">
                  Branch
                </span>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-[3px] bg-[#0F2F26] px-5 py-2.5 text-[14.5px] font-medium text-[#F6F3EC] transition-colors hover:bg-[#153D32] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending invite…" : "Send invite"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small subcomponents
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${
        active
          ? "border-[#0F2F26] text-[#0F2F26]"
          : "border-transparent text-[#8A9A92] hover:text-[#3D4F47]"
      }`}
    >
      {children}
    </button>
  );
}