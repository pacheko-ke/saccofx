"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Loan {
  loan_id: string;
  loan_account_number: string;
  member_id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  id_number: string;
  phone_primary: string;
  product_name: string;
  principal_amount: string;
  outstanding_principal: string;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = ["all", "pending", "disbursed", "closed", "written_off"];
const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#f3e6c8] text-[#7a5c1e]",
  disbursed: "bg-[#e4efe6] text-[#1c2b22]",
  closed: "bg-[#e2ddd0] text-[#4a5c50]",
  written_off: "bg-[#f4dede] text-[#8a2c2c]",
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/loans");
        if (!res.ok) throw new Error("Failed to load loans");
        const data = await res.json();
        const flatLoans = Array.isArray(data.loans[0]) ? data.loans.flat() : data.loans;
        setLoans(flatLoans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return loans.filter((l) => {
      const matchesStatus = status === "all" || l.status === status;
      if (!matchesStatus) return false;

      if (!q) return true;

      const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
      return (
        l.loan_account_number.toLowerCase().includes(q) ||
        l.member_number.toLowerCase().includes(q) ||
        l.product_name.toLowerCase().includes(q) ||
        l.first_name.toLowerCase().includes(q) ||
        l.last_name.toLowerCase().includes(q) ||
        fullName.includes(q) ||
        l.phone_primary.toLowerCase().includes(q) ||
        l.id_number.toLowerCase().includes(q)
      );
    });
  }, [loans, search, status]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#eee7d6]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#1c2b22]">Loans</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">Ledger of all loan accounts across the SACCO.</p>
          </div>
          <Link
            href="/dashboard/loans/application/new"
            className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
          >
            + Loan application
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by name, phone, member no., ID..."
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
                {s === "all" ? "All statuses" : s.replace("_", " ")}
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
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">App. No</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Applicant</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Applicant ID</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Product</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Loan amount</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Outstanding</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Status</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading loan ledger...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9aa79f]">
                    No loans found
                  </td>
                </tr>
              ) : (
                paginated.map((l) => (
                  <tr key={l.loan_id} className="hover:bg-[#eee7d6]/40">
                    <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">{l.loan_account_number}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      {l.first_name} {l.last_name}
                    </td>
                    <td className="px-4 py-3 text-[#4a5c50]">{l.id_number}</td>
                    <td className="px-4 py-3 text-[#4a5c50]">{l.product_name}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      KES {Number(l.principal_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      KES {Number(l.outstanding_principal).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[l.status] ?? "bg-[#e2ddd0] text-[#4a5c50]"
                        }`}
                      >
                        {l.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/loans/${l.loan_id}/repayments`}
                        className="font-medium text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#233a2c]"
                      >
                        View
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
            {filtered.length} loan{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
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