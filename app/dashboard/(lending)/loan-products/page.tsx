"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface LoanProduct {
  loan_product_id: string;
  product_name: string;
  product_code: string;
  min_principal: string;
  max_principal: string;
  min_tenure_months: number;
  max_tenure_months: number;
  interest_rate_pa: string;
  interest_method: string;
  repayment_frequency: string;
  max_multiplier_of_shares: string;
  requires_guarantors: boolean;
  min_guarantors: number;
  requires_collateral: boolean;
  processing_fee_pct: string;
  insurance_fee_pct: string;
  penalty_rate_pct: string;
  grace_period_days: number;
  is_active: boolean;
}

const STATUS_OPTIONS = ["all", "active", "inactive"];
const PAGE_SIZE = 20;

export default function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/loan-products");
        if (!res.ok) throw new Error("Failed to load loan products");
        const data = await res.json();
        setProducts(data.loanProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchesStatus = status === "all" || (status === "active" ? p.is_active : !p.is_active);
      if (!matchesStatus) return false;

      if (!q) return true;

      return p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q);
    });
  }, [products, search, status]);

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
            <h1 className="font-serif text-2xl text-[#1c2b22]">Loan products</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">Catalogue of loan products offered by the SACCO.</p>
          </div>
          <Link
            href="/dashboard/loan-products/new"
            className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
          >
            + New loan product
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by product name or code..."
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
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">{error}</div>
        )}

        {/* Ledger table */}
        <div className="overflow-x-auto rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 text-left">
              <tr>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Code</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Product name</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Principal range</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Tenure (months)</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Interest p.a.</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Method</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Status</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading loan products...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9aa79f]">
                    No loan products found
                  </td>
                </tr>
              ) : (
                paginated.map((p) => (
                  <tr key={p.loan_product_id} className="hover:bg-[#eee7d6]/40">
                    <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">{p.product_code}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">{p.product_name}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      KES {Number(p.min_principal).toLocaleString()} – {Number(p.max_principal).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-[#4a5c50]">
                      {p.min_tenure_months} – {p.max_tenure_months}
                    </td>
                    <td className="px-4 py-3 text-[#1c2b22]">{p.interest_rate_pa}%</td>
                    <td className="px-4 py-3 capitalize text-[#4a5c50]">
                      {p.interest_method?.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.is_active ? "bg-[#e4efe6] text-[#1c2b22]" : "bg-[#e2ddd0] text-[#4a5c50]"
                        }`}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/loan-products/${p.loan_product_id}`}
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
            {filtered.length} product{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
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