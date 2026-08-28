// app/reports/defaulters/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface DefaulterRecord {
  id: string;
  loanNumber: string;
  memberNumber: string;
  memberName: string;
  phoneNumber: string;
  productName: string;
  outstandingPrincipal: number; // COA 1200
  accruedInterest: number;      // COA 1210
  penaltyFees: number;          // COA 1220
  daysInArrears: number;
  lastPaymentDate: string;
  guarantorCount: number;
  guarantorCoverageRatio: number; // %
  recoveryStatus: "notice_issued" | "guarantor_attached" | "crb_listed" | "legal_action" | "pending_review";
}

const RECOVERY_STATUS_OPTIONS = [
  "all",
  "notice_issued",
  "guarantor_attached",
  "crb_listed",
  "legal_action",
  "pending_review",
];

const ARREARS_BUCKETS = ["all", "substandard", "doubtful", "loss"];
const PAGE_SIZE = 20;

const RECOVERY_STYLES: Record<string, string> = {
  notice_issued: "bg-[#f3e6c8] text-[#7a5c1e]",
  guarantor_attached: "bg-[#e2ddd0] text-[#4a5c50]",
  crb_listed: "bg-[#f4dede] text-[#8a2c2c]",
  legal_action: "bg-[#f4dede] font-semibold text-[#8a2c2c]",
  pending_review: "bg-[#eee7d6] text-[#1c2b22]",
};

const RECOVERY_LABELS: Record<string, string> = {
  notice_issued: "Demand Notice",
  guarantor_attached: "Guarantors Attached",
  crb_listed: "CRB Listed",
  legal_action: "Legal Recovery",
  pending_review: "Pending Review",
};

export default function LoanDefaultersPage() {
  const [defaulters, setDefaulters] = useState<DefaulterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [recoveryFilter, setRecoveryFilter] = useState("all");
  const [arrearsBucket, setArrearsBucket] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch defaulted loans on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/reports/defaulters");
        if (!res.ok) throw new Error("Failed to load defaulters ledger");
        const data = await res.json();
        setDefaulters(data.defaulters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter client-side
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return defaulters.filter((d) => {
      const matchesRecovery = recoveryFilter === "all" || d.recoveryStatus === recoveryFilter;

      let matchesBucket = true;
      if (arrearsBucket === "substandard") matchesBucket = d.daysInArrears > 90 && d.daysInArrears <= 180;
      if (arrearsBucket === "doubtful") matchesBucket = d.daysInArrears > 180 && d.daysInArrears <= 360;
      if (arrearsBucket === "loss") matchesBucket = d.daysInArrears > 360;

      if (!matchesRecovery || !matchesBucket) return false;

      if (!q) return true;

      return (
        d.loanNumber.toLowerCase().includes(q) ||
        d.memberName.toLowerCase().includes(q) ||
        d.memberNumber.toLowerCase().includes(q) ||
        d.phoneNumber.toLowerCase().includes(q)
      );
    });
  }, [defaulters, search, recoveryFilter, arrearsBucket]);

  // Reset page on filter state change
  useEffect(() => {
    setPage(1);
  }, [search, recoveryFilter, arrearsBucket]);

  // Aggregate metrics
  const stats = useMemo(() => {
    return filtered.reduce(
      (acc, d) => {
        const totalDue = d.outstandingPrincipal + d.accruedInterest + d.penaltyFees;
        acc.totalDefaultedAmount += totalDue;
        acc.totalPrincipalAtRisk += d.outstandingPrincipal;
        acc.totalPenaltiesAccrued += d.penaltyFees;
        if (d.daysInArrears > 360) acc.lossCategoryCount += 1;
        return acc;
      },
      { totalDefaultedAmount: 0, totalPrincipalAtRisk: 0, totalPenaltiesAccrued: 0, lossCategoryCount: 0 }
    );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(val);

  return (
    <div className="min-h-screen bg-[#eee7d6]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#1c2b22]">Loan Defaulters Report</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">
              Delinquent accounts, guarantor exposure, and debt recovery workflows (&gt;90 Days Arrears).
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/recovery/demand-notices"
              className="inline-flex items-center justify-center rounded-md border border-[#c9a24b]/50 bg-[#faf6ec] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
            >
              Issue Demand Notices
            </Link>
            <Link
              href="/dashboard/recovery/crb-export"
              className="inline-flex items-center justify-center rounded-md bg-[#8a2c2c] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#722323]"
            >
              Export CRB Listing
            </Link>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Total Defaulted Exposure
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#8a2c2c]">
              {formatCurrency(stats.totalDefaultedAmount)}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Principal Defaulted (COA 1200)
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#1c2b22]">
              {formatCurrency(stats.totalPrincipalAtRisk)}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Accrued Penalties (COA 1220)
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#7a5c1e]">
              {formatCurrency(stats.totalPenaltiesAccrued)}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Loss Accounts (&gt;360 Days)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-2xl font-semibold text-[#8a2c2c]">
                {stats.lossCategoryCount}
              </span>
              <span className="text-xs text-[#9aa79f]">Requires full provision</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by Loan No, Member, Phone Number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          />
          <select
            value={arrearsBucket}
            onChange={(e) => setArrearsBucket(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {ARREARS_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b === "all"
                  ? "All Non-Performing (>90d)"
                  : b === "substandard"
                  ? "Substandard (91-180d)"
                  : b === "doubtful"
                  ? "Doubtful (181-360d)"
                  : "Loss (>360d)"}
              </option>
            ))}
          </select>
          <select
            value={recoveryFilter}
            onChange={(e) => setRecoveryFilter(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {RECOVERY_STATUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All Recovery Actions" : RECOVERY_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">
            {error}
          </div>
        )}

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 text-left">
              <tr>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Loan No</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Borrower</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Total Due</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Arrears</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Guarantor Cover</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Recovery Stage</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading defaulters ledger...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9aa79f]">
                    No defaulted accounts match the criteria
                  </td>
                </tr>
              ) : (
                paginated.map((d) => {
                  const totalDue = d.outstandingPrincipal + d.accruedInterest + d.penaltyFees;

                  return (
                    <tr key={d.id} className="hover:bg-[#eee7d6]/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1c2b22]">
                        {d.loanNumber}
                        <div className="font-sans text-[11px] font-normal text-[#4a5c50]">
                          {d.productName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#1c2b22]">
                        <div className="font-medium">{d.memberName}</div>
                        <div className="font-mono text-xs text-[#4a5c50]">
                          {d.phoneNumber}{" "}
                          {d.memberNumber && (
                            <span className="text-[#9aa79f]">({d.memberNumber})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#1c2b22]">
                        <div className="font-semibold text-[#8a2c2c]">{formatCurrency(totalDue)}</div>
                        <div className="text-[11px] text-[#4a5c50]">
                          P: {formatCurrency(d.outstandingPrincipal)} | Fee: {formatCurrency(d.penaltyFees)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#1c2b22]">
                        <span className="font-semibold text-[#8a2c2c]">{d.daysInArrears} days</span>
                        <div className="text-[11px] text-[#4a5c50]">
                          Last: {new Date(d.lastPaymentDate).toLocaleDateString("en-KE")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#4a5c50]">
                        <div className="font-mono font-medium text-[#1c2b22]">
                          {d.guarantorCoverageRatio}% Cover
                        </div>
                        <div className="text-[11px]">
                          {d.guarantorCount} Guarantor{d.guarantorCount !== 1 ? "s" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            RECOVERY_STYLES[d.recoveryStatus] ?? "bg-[#e2ddd0] text-[#4a5c50]"
                          }`}
                        >
                          {RECOVERY_LABELS[d.recoveryStatus] ?? d.recoveryStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/recovery/${d.id}`}
                          className="font-medium text-[#7a5c1e] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#1c2b22]"
                        >
                          Manage Recovery
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#4a5c50]">
            {filtered.length} defaulter{filtered.length !== 1 ? "s" : ""} · Page {page} of{" "}
            {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[#c9a24b]/40 px-3 py-1 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[#c9a24b]/40 px-3 py-1 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}