"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BackBtn from "@/app/components/BackButton";
import { useState,useEffect } from "react";



interface NextOfKin {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  id_number: string | null;
  percentage_share: number | null;
}

interface SavingsAccountSummary {
  savings_account_id: string;
  account_no: string;
  product_name: string;
  balance: string;
  status: string;
}

interface LoanAccountSummary {
  loan_account_id: string;
  loan_no: string;
  product_name: string;
  principal_outstanding: string;
  status: string;
  days_overdue: number | null;
}

interface ShareAccountSummary {
  share_account_id: string;
  shares_held: number;
  value_at_par: string;
}

interface MemberProfile {
  member_id: string;
  member_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  id_number: string;
  date_of_birth: string;
  gender: string;
  marital_status: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  physical_address: string | null;
  branch_name: string;
  status: "active" | "dormant" | "suspended" | "closed";
  kyc_status: "pending" | "verified" | "rejected";
  join_date: string;
  photo_url: string | null;
  next_of_kin: NextOfKin[];
  savings_accounts: SavingsAccountSummary[];
  loan_accounts: LoanAccountSummary[];
  share_accounts: ShareAccountSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKES(value: string | number | null | undefined) {
  const n = Number(value);
  if (value == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

const STATUS_STYLES: Record<MemberProfile["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-[#e4efe6]", text: "text-[#1c2b22]", label: "Active" },
  dormant: { bg: "bg-[#f5efd9]", text: "text-[#8a6d1d]", label: "Dormant" },
  suspended: { bg: "bg-[#f5dcd2]", text: "text-[#9c3e21]", label: "Suspended" },
  closed: { bg: "bg-[#e2ddd0]", text: "text-[#4a5c50]", label: "Closed" },
};

const KYC_STYLES: Record<MemberProfile["kyc_status"], { bg: string; text: string; label: string }> = {
  verified: { bg: "bg-[#e4efe6]", text: "text-[#1c2b22]", label: "KYC Verified" },
  pending: { bg: "bg-[#f5efd9]", text: "text-[#8a6d1d]", label: "KYC Pending" },
  rejected: { bg: "bg-[#f5dcd2]", text: "text-[#9c3e21]", label: "KYC Rejected" },
};

type Tab = "overview" | "savings" | "loans" | "shares" | "next-of-kin";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/members/${params.id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setError("Member not found.");
          return;
        }
        if (!res.ok) throw new Error("Failed to load member");
        const data = await res.json();
        const raw = data.member ?? data;
        // Normalize once here so every array field is guaranteed to exist,
        // regardless of what the API omits (e.g. an empty LATERAL join
        // returning no key at all rather than an empty array).
        const normalized: MemberProfile = {
          ...raw,
          next_of_kin: raw.next_of_kin ?? [],
          savings_accounts: raw.savings_accounts ?? [],
          loan_accounts: raw.loan_accounts ?? [],
          share_accounts: raw.share_accounts ?? [],
        };
        if (!cancelled) setMember(normalized);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (params.id) load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const fullName = member
    ? [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ")
    : "";

  const totalSavings = (member?.savings_accounts ?? []).reduce(
    (sum, a) => sum + Number(a.balance || 0),
    0
  );
  const totalLoansOutstanding = (member?.loan_accounts ?? []).reduce(
    (sum, a) => sum + Number(a.principal_outstanding || 0),
    0
  );
  const totalShareValue = (member?.share_accounts ?? []).reduce(
    (sum, a) => sum + Number(a.value_at_par || 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <BackBtn/>

        {loading && (
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] px-6 py-12 text-center text-[#9aa79f]">
            Loading member profile...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] px-6 py-12 text-center">
            <p className="text-sm text-[#8a2c2c]">{error}</p>
            <button
              onClick={() => router.push("/dashboard/members")}
              className="mt-4 text-sm text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2"
            >
              Return to members
            </button>
          </div>
        )}

        {!loading && !error && member && (
          <>
            {/* Passbook-style header */}
            <div className="overflow-hidden rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
              <div className="border-b border-[#c9a24b]/30 bg-[#1c2b22] px-6 py-6 text-[#faf6ec]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    {member.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.photo_url}
                        alt={fullName}
                        className="h-16 w-16 rounded-full border-2 border-[#c9a24b] object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#c9a24b] bg-[#233a2c] font-serif text-xl">
                        {initials(member.first_name, member.last_name)}
                      </div>
                    )}
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#c9a24b]">
                        {member.member_no}
                      </p>
                      <h1 className="mt-1 font-serif text-2xl">{fullName}</h1>
                      <p className="mt-0.5 text-sm text-[#faf6ec]/70">{member.branch_name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium  ${STATUS_STYLES[member.status]?.text}`}
                    >
                      {STATUS_STYLES[member.status]?.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${KYC_STYLES[member.kyc_status]?.bg} ${KYC_STYLES[member.kyc_status]?.text}`}
                    >
                      {KYC_STYLES[member.kyc_status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial summary strip */}
              <div className="grid grid-cols-1 divide-y divide-[#c9a24b]/20 border-b border-[#c9a24b]/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <SummaryCell label="Savings balance" value={formatKES(totalSavings)} />
                <SummaryCell label="Loans outstanding" value={formatKES(totalLoansOutstanding)} accent />
                <SummaryCell label="Share value" value={formatKES(totalShareValue)} />
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-[#c9a24b]/30 px-4 pt-3">
                {(
                  [
                    ["overview", "Overview"],
                    ["savings", `Savings (${member.savings_accounts.length})`],
                    ["loans", `Loans (${member.loan_accounts.length})`],
                    ["shares", `Shares (${member.share_accounts.length})`],
                    ["next-of-kin", `Next of kin (${member.next_of_kin.length})`],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                      tab === key
                        ? "border-b-2 border-[#c9a24b] text-[#1c2b22]"
                        : "text-[#4a5c50] hover:text-[#1c2b22]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="px-6 py-5">
                {tab === "overview" && (
                  <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                    <Section title="Identification">
                      <DetailRow label="ID number">{member.id_number}</DetailRow>
                      <DetailRow label="Date of birth">{formatDate(member.date_of_birth)}</DetailRow>
                      <DetailRow label="Gender">
                        <span className="capitalize">{member.gender}</span>
                      </DetailRow>
                      <DetailRow label="Marital status">
                        <span className="capitalize">{member.marital_status ?? "—"}</span>
                      </DetailRow>
                    </Section>
                    <Section title="Contact">
                      <DetailRow label="Primary phone">{member.phone_primary}</DetailRow>
                      <DetailRow label="Alternate phone">{member.phone_secondary ?? "—"}</DetailRow>
                      <DetailRow label="Email">{member.email ?? "—"}</DetailRow>
                      <DetailRow label="Address">{member.physical_address ?? "—"}</DetailRow>
                    </Section>
                    <Section title="Membership">
                      <DetailRow label="Member since">{formatDate(member.join_date)}</DetailRow>
                      <DetailRow label="Branch">{member.branch_name}</DetailRow>
                    </Section>
                  </div>
                )}

                {tab === "savings" && (
                  <AccountTable
                    empty="No savings accounts on record."
                    columns={["Account no.", "Product", "Balance", "Status"]}
                    rows={member.savings_accounts.map((a) => [
                      a.account_no,
                      a.product_name,
                      formatKES(a.balance),
                      <StatusPill key={a.savings_account_id} value={a.status} />,
                    ])}
                  />
                )}

                {tab === "loans" && (
                  <AccountTable
                    empty="No loan accounts on record."
                    columns={["Loan no.", "Product", "Principal O/S", "Status"]}
                    rows={member.loan_accounts.map((a) => [
                      <Link
                        key={a.loan_account_id}
                        href={`/dashboard/loans/${a.loan_account_id}`}
                        className="text-[#1c2b22] underline decoration-[#c9a24b] decoration-1 underline-offset-4 hover:text-[#8a6d1d]"
                      >
                        {a.loan_no}
                      </Link>,
                      a.product_name,
                      formatKES(a.principal_outstanding),
                      <span key={`${a.loan_account_id}-status`} className="flex items-center gap-2">
                        <StatusPill value={a.status} />
                        {a.days_overdue != null && a.days_overdue > 0 && (
                          <span className="text-xs text-[#9c3e21]">{a.days_overdue}d overdue</span>
                        )}
                      </span>,
                    ])}
                  />
                )}

                {tab === "shares" && (
                  <AccountTable
                    empty="No share accounts on record."
                    columns={["Account", "Shares held", "Value at par"]}
                    rows={member.share_accounts.map((a) => [
                      a.share_account_id.slice(0, 8),
                      a.shares_held.toLocaleString(),
                      formatKES(a.value_at_par),
                    ])}
                  />
                )}

                {tab === "next-of-kin" && (
                  <>
                    {member.next_of_kin.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#9aa79f]">
                        No next of kin on record.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {member.next_of_kin.map((k) => (
                          <div
                            key={k.id}
                            className="rounded-md border border-[#c9a24b]/30 bg-[#eee7d6]/40 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-serif text-[#1c2b22]">{k.full_name}</p>
                              <span className="text-xs capitalize text-[#8a6d1d]">{k.relationship}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-6 text-xs text-[#4a5c50]">
                              <span>{k.phone}</span>
                              {k.id_number && <span>ID {k.id_number}</span>}
                              {k.percentage_share != null && (
                                <span>{k.percentage_share}% beneficiary share</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/dashboard/members/${member.member_id}/edit`}
                className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-4 py-2 text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
              >
                Edit member
              </Link>
              <Link
                href={`/dashboard/loans/new?memberId=${member.member_id}`}
                className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-4 py-2 text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
              >
                New loan application
              </Link>
              <Link
                href={`/dashboard/members/${member.member_id}/statement`}
                className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
              >
                View statement
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-6 py-4">
      <p className="font-mono text-xs uppercase tracking-wide text-[#4a5c50]">{label}</p>
      <p className={`mt-1 font-serif text-xl ${accent ? "text-[#9c3e21]" : "text-[#1c2b22]"}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-serif text-sm uppercase tracking-wide text-[#8a6d1d]">{title}</h2>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-[#c9a24b]/30 pb-1">
      <dt className="text-xs text-[#4a5c50]">{label}</dt>
      <dd className="text-right font-mono text-sm text-[#1c2b22]">{children}</dd>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value?.toLowerCase();
  const positive = ["active", "disbursed", "current"].includes(normalized);
  const negative = ["defaulted", "written_off", "closed", "suspended"].includes(normalized);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        positive
          ? "bg-[#e4efe6] text-[#1c2b22]"
          : negative
          ? "bg-[#f5dcd2] text-[#9c3e21]"
          : "bg-[#f5efd9] text-[#8a6d1d]"
      }`}
    >
      {value?.replace(/_/g, " ")}
    </span>
  );
}

function AccountTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[#9aa79f]">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#c9a24b]/30 text-left">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-serif font-medium text-[#1c2b22]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#c9a24b]/15 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-3 text-[#1c2b22]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}