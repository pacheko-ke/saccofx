// lib/settings/users-roles.ts
// Data types and fetch/mutation helpers for the Users & Roles page.
// This manages STAFF accounts (back-office users), not the member portal.
// Every list/mutation is tenant-scoped — a user row always belongs to
// exactly one tenantId, sourced server-side from the verified JWT of the
// admin performing the action, never from the request body.

export type StaffRole =
  | "SUPERADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "LOAN_OFFICER"
  | "TELLER"
  | "AUDITOR";

export type StaffStatus = "ACTIVE" | "INVITED" | "SUSPENDED";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  branch: string;
  status: StaffStatus;
  lastActiveAt: string | null; // ISO timestamp, null if never signed in
  invitedAt: string; // ISO timestamp
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  BRANCH_MANAGER: "Branch Manager",
  LOAN_OFFICER: "Loan Officer",
  TELLER: "Teller",
  AUDITOR: "Auditor",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  SUPERADMIN: "Full access, including billing and the ability to manage other admins.",
  ADMIN: "Full operational access: configuration, users, loans, tellering and reports.",
  BRANCH_MANAGER: "Approves loans and oversees tellers within their assigned branch.",
  LOAN_OFFICER: "Appraises, disburses and manages the loan lifecycle.",
  TELLER: "Handles member deposits, withdrawals and till reconciliation.",
  AUDITOR: "Read-only access across the system for review and SASRA audit purposes.",
};

export type PermissionLevel = "FULL" | "VIEW" | "NONE";

export interface PermissionGroup {
  key: string;
  label: string;
  levels: Record<StaffRole, PermissionLevel>;
}

export const PERMISSION_MATRIX: PermissionGroup[] = [
  {
    key: "members",
    label: "Member management",
    levels: {
      SUPERADMIN: "FULL",
      ADMIN: "FULL",
      BRANCH_MANAGER: "FULL",
      LOAN_OFFICER: "VIEW",
      TELLER: "VIEW",
      AUDITOR: "VIEW",
    },
  },
  {
    key: "teller",
    label: "Teller operations (deposits & withdrawals)",
    levels: {
      SUPERADMIN: "FULL",
      ADMIN: "FULL",
      BRANCH_MANAGER: "VIEW",
      LOAN_OFFICER: "NONE",
      TELLER: "FULL",
      AUDITOR: "VIEW",
    },
  },
  {
    key: "loans",
    label: "Loan lifecycle (appraise, disburse, restructure, write-off)",
    levels: {
      SUPERADMIN: "FULL",
      ADMIN: "FULL",
      BRANCH_MANAGER: "FULL",
      LOAN_OFFICER: "FULL",
      TELLER: "NONE",
      AUDITOR: "VIEW",
    },
  },
  {
    key: "gl",
    label: "General ledger & financial reports",
    levels: {
      SUPERADMIN: "FULL",
      ADMIN: "FULL",
      BRANCH_MANAGER: "VIEW",
      LOAN_OFFICER: "NONE",
      TELLER: "NONE",
      AUDITOR: "VIEW",
    },
  },
  {
    key: "config",
    label: "SACCO configuration",
    levels: {
      SUPERADMIN: "FULL",
      ADMIN: "FULL",
      BRANCH_MANAGER: "NONE",
      LOAN_OFFICER: "NONE",
      TELLER: "NONE",
      AUDITOR: "NONE",
    },
  },
  {
    key: "users",
    label: "User & role management",
    levels: {
      SUPERADMIN: "FULL",
      ADMIN: "FULL",
      BRANCH_MANAGER: "NONE",
      LOAN_OFFICER: "NONE",
      TELLER: "NONE",
      AUDITOR: "NONE",
    },
  },
];

export const BRANCHES = ["Nairobi CBD", "Kiambu Road", "Thika", "Nakuru"];

/**
 * Fetches all staff users for the current tenant.
 *
 * TODO: replace with a real Server Action that:
 *   1. Verifies the JWT (sfx_session), pulls tenantId + role
 *   2. Requires role ADMIN or SUPERADMIN
 *   3. Runs `SET LOCAL app.current_tenant = $1` (Neon `Pool`) and selects
 *      from the `staff_users` table for that tenant only
 */
export async function getStaffUsers(): Promise<StaffUser[]> {
  await new Promise((r) => setTimeout(r, 300));

  return [
    {
      id: "u1",
      name: "Wanjiku Muriithi",
      email: "wanjiku@amanisacco.co.ke",
      role: "SUPERADMIN",
      branch: "Nairobi CBD",
      status: "ACTIVE",
      lastActiveAt: "2026-08-18T07:42:00Z",
      invitedAt: "2025-02-01T09:00:00Z",
    },
    {
      id: "u2",
      name: "Peter Kamau",
      email: "peter.kamau@amanisacco.co.ke",
      role: "TELLER",
      branch: "Nairobi CBD",
      status: "ACTIVE",
      lastActiveAt: "2026-08-18T06:58:00Z",
      invitedAt: "2025-03-14T09:00:00Z",
    },
    {
      id: "u3",
      name: "Mercy Achieng",
      email: "mercy.achieng@amanisacco.co.ke",
      role: "LOAN_OFFICER",
      branch: "Kiambu Road",
      status: "ACTIVE",
      lastActiveAt: "2026-08-17T15:20:00Z",
      invitedAt: "2025-04-02T09:00:00Z",
    },
    {
      id: "u4",
      name: "Samuel Kiptoo",
      email: "samuel.kiptoo@amanisacco.co.ke",
      role: "BRANCH_MANAGER",
      branch: "Thika",
      status: "ACTIVE",
      lastActiveAt: "2026-08-16T11:05:00Z",
      invitedAt: "2025-05-20T09:00:00Z",
    },
    {
      id: "u5",
      name: "Faith Chebet",
      email: "faith.chebet@amanisacco.co.ke",
      role: "TELLER",
      branch: "Nakuru",
      status: "INVITED",
      lastActiveAt: null,
      invitedAt: "2026-08-15T09:00:00Z",
    },
    {
      id: "u6",
      name: "David Otieno",
      email: "david.otieno@amanisacco.co.ke",
      role: "LOAN_OFFICER",
      branch: "Nairobi CBD",
      status: "SUSPENDED",
      lastActiveAt: "2026-06-02T10:11:00Z",
      invitedAt: "2025-06-11T09:00:00Z",
    },
    {
      id: "u7",
      name: "Nexus & Associates (Auditor)",
      email: "audit@nexusassociates.co.ke",
      role: "AUDITOR",
      branch: "Nairobi CBD",
      status: "ACTIVE",
      lastActiveAt: "2026-07-30T13:40:00Z",
      invitedAt: "2025-01-15T09:00:00Z",
    },
  ];
}

/**
 * Sends an invitation to a new staff member.
 * TODO: real Server Action — creates a pending `staff_users` row scoped to
 * tenantId, generates a signed invite token, and sends it via Resend.
 */
export async function inviteStaffUser(input: {
  name: string;
  email: string;
  role: StaffRole;
  branch: string;
}): Promise<StaffUser> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    id: `u_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    email: input.email,
    role: input.role,
    branch: input.branch,
    status: "INVITED",
    lastActiveAt: null,
    invitedAt: new Date().toISOString(),
  };
}

/** TODO: real Server Action — updates role for a user within this tenant. */
export async function updateStaffUserRole(userId: string, role: StaffRole): Promise<{ ok: true }> {
  await new Promise((r) => setTimeout(r, 350));
  return { ok: true };
}

/** TODO: real Server Action — toggles ACTIVE/SUSPENDED for a user within this tenant. */
export async function setStaffUserStatus(
  userId: string,
  status: StaffStatus
): Promise<{ ok: true }> {
  await new Promise((r) => setTimeout(r, 350));
  return { ok: true };
}

/** TODO: real Server Action — resends the invite email/token for a pending user. */
export async function resendInvite(userId: string): Promise<{ ok: true }> {
  await new Promise((r) => setTimeout(r, 350));
  return { ok: true };
}