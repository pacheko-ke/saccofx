"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface LoanRepayment {
  id: string;
  repaymentId: string;
  loanId: string;
  memberNumber: string;
  memberName: string;
  amount: number;
  principalPaid: number;
  interestPaid: number;
  paymentMethod: string;
  status: string;
  paidAt: string;
}

const STATUS_OPTIONS = ["all", "completed", "pending", "failed", "reversed"];
const METHOD_OPTIONS = ["all", "mpesa", "bank_transfer", "cash", "cheque"];
const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-[#e4efe6] text-[#1c2b22]",
  pending: "bg-[#f3e6c8] text-[#7a5c1e]",
  failed: "bg-[#f4dede] text-[#8a2c2c]",
  reversed: "bg-[#e2ddd0] text-[#4a5c50]",
};

export default function LoanRepaymentsPage() {
  const [allRepayments, setAllRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch full repayment ledger on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/loan-repayments");
        if (!res.ok) throw new Error("Failed to load loan repayments");
        const data = await res.json();
        setAllRepayments(data.repayments);
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

    return allRepayments.filter((r) => {
      const matchesStatus = status === "all" || r.status === status;
      const matchesMethod = method === "all" || r.paymentMethod === method;
      if (!matchesStatus || !matchesMethod) return false;

      if (!q) return true;

      return (
        r.repaymentId.toLowerCase().includes(q) ||
        r.loanId.toLowerCase().includes(q) ||
        r.memberNumber.toLowerCase().includes(q) ||
        r.memberName.toLowerCase().includes(q)
      );
    });
  }, [allRepayments, search, status, method]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, method]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Helper for currency formatting
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(val);

  return (
    <div className="min-h-screen bg-[#eee7d6]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#1c2b22]">Loan Repayments</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">Ledger of all loan payments received.</p>
          </div>
          <Link
            href="/dashboard/loans/record-repayment"
            className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
          >
            + Record Repayment
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by Txn ID, Loan ID, Member No., Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          />
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
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm capitalize text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m} className="capitalize">
                {m === "all" ? "All methods" : m.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">{error}</div>
        )}

        {/* Ledger table */}
        <div className="overflow-x-auto rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 text-left">
              <tr>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Date</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Txn Ref</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Member</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Method</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Principal</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Interest</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Total Paid</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Status</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading repayments...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#9aa79f]">
                    No repayments found
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr key={r.id} className="hover:bg-[#eee7d6]/40">
                    <td className="px-4 py-3 text-[#4a5c50]">
                      {new Date(r.paidAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">{r.repaymentId}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      <div className="font-medium">{r.memberName}</div>
                      <div className="font-mono text-xs text-[#9aa79f]">{r.memberNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-[#4a5c50]">
                      {r.paymentMethod.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-[#4a5c50]">{formatCurrency(r.principalPaid)}</td>
                    <td className="px-4 py-3 text-[#4a5c50]">{formatCurrency(r.interestPaid)}</td>
                    <td className="px-4 py-3 font-medium text-[#1c2b22]">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[r.status] ?? "bg-[#e2ddd0] text-[#4a5c50]"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/loans/repayments/${r.id}`}
                        className="font-medium text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#233a2c]"
                      >
                        Receipt
                      </Link>
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
            {filtered.length} record{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
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