"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface MobileMoneyTransaction {
  id: string;
  transactionCode: string; // e.g. QKH782910A
  phoneNumber: string;
  senderName: string;
  memberNumber: string | null; // Null if unmatched to a member
  amount: number;
  transactionType: "repayment" | "savings" | "share_capital" | "unallocated";
  status: "completed" | "pending" | "failed" | "reversed";
  timestamp: string;
}

const TYPE_OPTIONS = [
  "all",
  "repayment",
  "savings",
  "share_capital",
  "unallocated",
];
const STATUS_OPTIONS = ["all", "completed", "pending", "failed", "reversed"];
const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-[#e4efe6] text-[#1c2b22]",
  pending: "bg-[#f3e6c8] text-[#7a5c1e]",
  failed: "bg-[#f4dede] text-[#8a2c2c]",
  reversed: "bg-[#e2ddd0] text-[#4a5c50]",
};

const TYPE_LABELS: Record<string, string> = {
  repayment: "Loan Repayment",
  savings: "Savings Deposit",
  share_capital: "Share Capital",
  unallocated: "Unallocated",
};

export default function MobileMoneyPage() {
  const [transactions, setTransactions] = useState<MobileMoneyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch mobile money receipts on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/mobile-money");
        if (!res.ok) throw new Error("Failed to load mobile money ledger");
        const data = await res.json();
        setTransactions(data.transactions);
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

    return transactions.filter((t) => {
      const matchesStatus = status === "all" || t.status === status;
      const matchesType = type === "all" || t.transactionType === type;
      if (!matchesStatus || !matchesType) return false;

      if (!q) return true;

      return (
        t.transactionCode.toLowerCase().includes(q) ||
        t.phoneNumber.toLowerCase().includes(q) ||
        t.senderName.toLowerCase().includes(q) ||
        (t.memberNumber && t.memberNumber.toLowerCase().includes(q))
      );
    });
  }, [transactions, search, status, type]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, type]);

  // Aggregate stats for top metrics cards
  const stats = useMemo(() => {
    const totalCollected = filtered
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    const unallocatedCount = filtered.filter(
      (t) => t.transactionType === "unallocated" && t.status === "completed"
    ).length;

    return { totalCollected, unallocatedCount };
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
            <h1 className="font-serif text-2xl text-[#1c2b22]">Mobile Money Receipts</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">
              Real-time C2B M-Pesa statements and automated reconciliations.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/mobile-money/stk-push"
              className="inline-flex items-center justify-center rounded-md border border-[#c9a24b]/50 bg-[#faf6ec] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
            >
              STK Prompt
            </Link>
            <Link
              href="/dashboard/mobile-money/reconcile"
              className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
            >
              Reconcile Manual
            </Link>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Total Processed (Filtered)
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#1c2b22]">
              {formatCurrency(stats.totalCollected)}
            </div>
          </div>
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Unallocated Receipts
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-2xl font-semibold text-[#8a2c2c]">
                {stats.unallocatedCount}
              </span>
              <span className="text-xs text-[#9aa79f]">Requires member matching</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by Receipt Code, Phone, Name, Member No..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All Allocation Types" : TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm capitalize text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s}
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
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Time</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">M-Pesa Code</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Sender</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Allocation</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Amount</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Status</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading transactions...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9aa79f]">
                    No transactions found
                  </td>
                </tr>
              ) : (
                paginated.map((t) => (
                  <tr key={t.id} className="hover:bg-[#eee7d6]/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#4a5c50]">
                      {new Date(t.timestamp).toLocaleString("en-KE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1c2b22]">
                      {t.transactionCode}
                    </td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      <div className="font-medium">{t.senderName}</div>
                      <div className="font-mono text-xs text-[#4a5c50]">
                        {t.phoneNumber}
                        {t.memberNumber && (
                          <span className="ml-1 text-[#9aa79f]">({t.memberNumber})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4a5c50]">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 ${
                          t.transactionType === "unallocated"
                            ? "bg-[#f4dede] font-semibold text-[#8a2c2c]"
                            : "bg-[#eee7d6]/60 text-[#1c2b22]"
                        }`}
                      >
                        {TYPE_LABELS[t.transactionType] ?? t.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-[#1c2b22]">
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[t.status] ?? "bg-[#e2ddd0] text-[#4a5c50]"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.transactionType === "unallocated" ? (
                        <Link
                          href={`/dashboard/mobile-money/match?id=${t.id}`}
                          className="font-medium text-[#7a5c1e] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#1c2b22]"
                        >
                          Assign
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/mobile-money/${t.id}`}
                          className="font-medium text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#233a2c]"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#4a5c50]">
            {filtered.length} receipt{filtered.length !== 1 ? "s" : ""} · Page {page} of{" "}
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