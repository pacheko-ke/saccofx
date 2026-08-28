"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/app/components/SideBar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParBucket = "1-30" | "31-60" | "61-90" | "90+";

interface Defaulter {
 memberId: string;
  memberNo: string;
  memberName: string;
  branches: string;
  loanNo: string;
  loanProduct: string;
  principalOutstanding: number;
  arrearsAmount: number;
  daysOverdue: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  phone: string;
  guarantorCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parBucketOf(daysOverdue: number): ParBucket {
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

const BUCKET_STYLES: Record<ParBucket, { bg: string; text: string; border: string; label: string }> = {
  "1-30": { bg: "bg-[#f5efd9]", text: "text-[#8a6d1d]", border: "border-[#c9a24b]/50", label: "Early — 1-30 days" },
  "31-60": { bg: "bg-[#f7e6cf]", text: "text-[#9a5b1f]", border: "border-[#c9821f]/50", label: "Watch — 31-60 days" },
  "61-90": { bg: "bg-[#f5dcd2]", text: "text-[#9c3e21]", border: "border-[#c9531f]/50", label: "Substandard — 61-90 days" },
  "90+": { bg: "bg-[#f2d3d3]", text: "text-[#8f2323]", border: "border-[#b83a3a]/50", label: "Doubtful — 90+ days" },
};

function formatKES(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}



// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoanDefaultersPage() {
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [branchesFilter, setbranchesFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<ParBucket | "all">("all");
  const [sortKey, setSortKey] = useState<"daysOverdue" | "arrearsAmount">("daysOverdue");

  useEffect(() => {
    let cancelled = false;
// 
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/loans/defaulters", { cache: "no-store" });
        if (!res.ok) throw new Error("request failed");
        const data = await res.json();
        if (!cancelled) setDefaulters(data.defaulters ?? data);
      } catch {
        // Fallback to mock data during development
        if (!cancelled) {
          setDefaulters([]);
          setError(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const branches = useMemo(
    () => Array.from(new Set(defaulters.map((d) => d.branches))).sort(),
    [defaulters]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return defaulters
      .filter((d) => {
        if (branchesFilter !== "all" && d.branches !== branchesFilter) return false;
        if (bucketFilter !== "all" && parBucketOf(d.daysOverdue) !== bucketFilter) return false;
        if (
          q &&
          !d.memberName.toLowerCase().includes(q) &&
          !d.memberNo.toLowerCase().includes(q) &&
          !d.loanNo.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b[sortKey] - a[sortKey]);
  }, [defaulters, search, branchesFilter, bucketFilter, sortKey]);

  const summary = useMemo(() => {
    const totalArrears = filtered.reduce((sum, d) => sum + d.arrearsAmount, 0);
    const totalExposure = filtered.reduce((sum, d) => sum + d.principalOutstanding, 0);
    const bucketCounts: Record<ParBucket, number> = { "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    filtered.forEach((d) => bucketCounts[parBucketOf(d.daysOverdue)]++);
    return { totalArrears, totalExposure, bucketCounts, count: filtered.length };
  }, [filtered]);

  return (
    <>
    <Sidebar></Sidebar>
    <div className="min-h-screen md:pl-20 bg-[#faf6ec]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-1 border-b border-[#c9a24b]/40 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8a6d1d]">
            Loans &middot; Portfolio at Risk
          </p>
          <h1 className="font-serif text-3xl text-[#1c2b22]">Loan Defaulters Register</h1>
          <p className="max-w-2xl text-sm text-[#1c2b22]/60">
            Members with loans in arrears, grouped by days overdue. Figures update as repayments post.
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Defaulting members" value={summary.count.toString()} />
          <SummaryCard label="Total arrears" value={formatKES(summary.totalArrears)} accent />
          <SummaryCard label="Principal at risk" value={formatKES(summary.totalExposure)} />
          <SummaryCard
            label="90+ days (doubtful)"
            value={summary.bucketCounts["90+"].toString()}
            warn={summary.bucketCounts["90+"] > 0}
          />
        </div>

        {/* PAR bucket breakdown */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(BUCKET_STYLES) as ParBucket[]).map((bucket) => {
            const style = BUCKET_STYLES[bucket];
            const isActive = bucketFilter === bucket;
            return (
              <button
                key={bucket}
                onClick={() => setBucketFilter(isActive ? "all" : bucket)}
                className={`rounded-sm border ${style.border} ${style.bg} px-3 py-2 text-left transition-shadow ${
                  isActive ? "ring-2 ring-[#1c2b22]/40" : ""
                }`}
              >
                <p className={`font-mono text-xs ${style.text}`}>{style.label}</p>
                <p className="mt-1 font-serif text-xl text-[#1c2b22]">
                  {summary.bucketCounts[bucket]}
                </p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Search member, member no, or loan no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-sm border border-[#c9a24b]/50 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#1c2b22]/40 focus:border-[#1c2b22] focus:outline-none sm:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={branchesFilter}
              onChange={(e) => setbranchesFilter(e.target.value)}
              className="rounded-sm border border-[#c9a24b]/50 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as "daysOverdue" | "arrearsAmount")}
              className="rounded-sm border border-[#c9a24b]/50 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
            >
              <option value="daysOverdue">Sort: Days overdue</option>
              <option value="arrearsAmount">Sort: Arrears amount</option>
            </select>
            {bucketFilter !== "all" && (
              <button
                onClick={() => setBucketFilter("all")}
                className="text-xs text-[#8a6d1d] underline decoration-[#c9a24b] underline-offset-4"
              >
                Clear bucket filter
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-sm border border-[#c9a24b]/40 bg-[#eee7d6]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#c9a24b]/50 text-left font-serif text-[#1c2b22]">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Loan</th>
                  <th className="px-4 py-3 font-medium">branches</th>
                  <th className="px-4 py-3 text-right font-medium">Principal O/S</th>
                  <th className="px-4 py-3 text-right font-medium">Arrears</th>
                  <th className="px-4 py-3 text-center font-medium">Days overdue</th>
                  <th className="px-4 py-3 font-medium">Last payment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[#1c2b22]/50">
                      Loading defaulters register...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[#1c2b22]/50">
                      No defaulters match this filter. That's either good news or a filter worth loosening.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((d) => {
                    const bucket = parBucketOf(d.daysOverdue);
                    const style = BUCKET_STYLES[bucket];
                    return (
                      <tr
                        key={d.memberId}
                        className="border-b border-[#c9a24b]/20 last:border-0 hover:bg-[#faf6ec]"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/members/${d.memberId}`}
                            className="text-[#1c2b22] underline decoration-[#c9a24b] decoration-1 underline-offset-4 hover:text-[#8a6d1d]"
                          >
                            {d.memberName}
                          </Link>
                          <p className="font-mono text-xs text-[#1c2b22]/50">{d.memberNo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-[#1c2b22]/70">{d.loanNo}</p>
                          <p className="text-xs text-[#1c2b22]/50">{d.loanProduct}</p>
                        </td>
                        <td className="px-4 py-3 text-[#1c2b22]/80">{d.branches}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#1c2b22]">
                          {formatKES(d.principalOutstanding)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#9c3e21]">
                          {formatKES(d.arrearsAmount)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[#1c2b22]">
                          {d.daysOverdue}
                        </td>
                        <td className="px-4 py-3 text-[#1c2b22]/70">
                          <p>{formatDate(d.lastPaymentDate)}</p>
                          {d.lastPaymentAmount && (
                            <p className="font-mono text-xs text-[#1c2b22]/50">
                              {formatKES(d.lastPaymentAmount)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full border ${style.border} ${style.bg} ${style.text} px-2.5 py-1 text-xs font-medium`}
                          >
                            {bucket} days
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-[#1c2b22]/40">
          Showing {filtered.length} of {defaulters.length} defaulting loans.
        </p>
      </div>
    </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary card subcomponent
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-sm border border-[#c9a24b]/40 bg-[#eee7d6] px-4 py-4">
      <p className="font-mono text-xs uppercase tracking-wide text-[#1c2b22]/50">{label}</p>
      <p
        className={`mt-1 font-serif text-2xl ${
          warn ? "text-[#8f2323]" : accent ? "text-[#8a6d1d]" : "text-[#1c2b22]"
        }`}
      >
        {value}
      </p>
    </div>
    
  );
}