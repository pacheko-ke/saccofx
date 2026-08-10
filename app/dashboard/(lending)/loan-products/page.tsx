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
      const matchesStatus =
        status === "all" ||
        (status === "active" ? p.is_active : !p.is_active);
      if (!matchesStatus) return false;

      if (!q) return true;

      return (
        p.product_name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q)
      );
    });
  }, [products, search, status]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-2 mt-10 flex flex-col gap-4 md:mx-20 mb-4">
      <Link
        href="/dashboard/loan-products/new"
        className="text-white bg-orange-400 px-4 py-2 rounded-md self-end"
      >
        + New Loan Product
      </Link>
      <h1 className="text-xl font-semibold mb-4">Loan Products</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by product name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-3 py-2 text-sm capitalize"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Product Name</th>
              <th className="px-4 py-2">Principal Range</th>
              <th className="px-4 py-2">Tenure (months)</th>
              <th className="px-4 py-2">Interest p.a.</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No loan products found
                </td>
              </tr>
            ) : (
              paginated.map((p) => (
                <tr key={p.loan_product_id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{p.product_code}</td>
                  <td className="px-4 py-2">{p.product_name}</td>
                  <td className="px-4 py-2">
                    KES {Number(p.min_principal).toLocaleString()} –{" "}
                    {Number(p.max_principal).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {p.min_tenure_months} – {p.max_tenure_months}
                  </td>
                  <td className="px-4 py-2">{p.interest_rate_pa}%</td>
                  <td className="px-4 py-2 capitalize">
                    {p.interest_method?.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        p.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/loan-products/${p.loan_product_id}`}
                      className="text-emerald-800 hover:underline"
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

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-500">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""} · Page{" "}
          {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}