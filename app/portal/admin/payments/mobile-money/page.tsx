// app/reports/loan-portfolio/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface LoanPortfolioRecord {
  id: string;
  loanNumber: string;
  memberNumber: string;
  memberName: string;
  productName: string;
  productCode: string;
  disbursedAmount: number;
  coa1200Principal: number; // Asset: Loan Principal
  coa1210Interest: number;  // Asset: Interest Receivable
  coa1220Penalties: number; // Asset: Penalty Receivable
  daysInArrears: number;
  maturityDate: string;
  lastVoucherRef: string;
}

const PRODUCT_OPTIONS = ["all", "DEV-01", "EMG-02", "AST-01"];
const CLASSIFICATION_OPTIONS = ["all", "performing", "watch", "non_performing"];
const PAGE_SIZE = 20;

const CLASSIFICATION_STYLES: Record<string, string> = {
  performing: "bg-[#e4efe6] text-[#1c2b22]",
  watch: "bg-[#f3e6c8] text-[#7a5c1e]",
  substandard: "bg-[#f4dede] text-[#8a2c2c]",
  doubtful: "bg-[#e2ddd0] text-[#4a5c50]",
  loss: "bg-[#f4dede] font-semibold text-[#8a2c2c]",
};

export default function LoanPortfolioPage() {
  const [loans, setLoans] = useState<LoanPortfolioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("all");
  const [classification, setClassification] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch portfolio ledger on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/reports/loan-portfolio");
        if (!res.ok) throw new Error("Failed to load loan portfolio ledger");
        const data = await res.json();
        setLoans(data.loans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // SASRA Risk Category Label Helper
  const getSasraClassification = (days: number): { label: string; key: string } => {
    if (days <= 30) return { label: "Performing (1%)", key: "performing" };
    if (days <= 90) return { label: "Watch (5%)", key: "watch" };
    if (days <= 180) return { label: "Substandard (25%)", key: "substandard" };
    if (days <= 360) return { label: "Doubtful (50%)", key: "doubtful" };
    return { label: "Loss (100%)", key: "loss" };
  };

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return loans.filter((l) => {
      const matchesProduct = product === "all" || l.productCode === product;

      let matchesClass = true;
      if (classification === "performing") matchesClass = l.daysInArrears <= 30;
      if (classification === "watch") matchesClass = l.daysInArrears > 30 && l.daysInArrears <= 90;
      if (classification === "non_performing") matchesClass = l.daysInArrears > 90;

      if (!matchesProduct || !matchesClass) return false;

      if (!q) return true;

      return (
        l.loanNumber.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q) ||
        l.memberNumber.toLowerCase().includes(q) ||
        l.lastVoucherRef.toLowerCase().includes(q)
      );
    });
  }, [loans, search, product, classification]);

  // Reset page on filter mutation
  useEffect(() => {
    setPage(1);
  }, [search, product, classification]);

  // Aggregate metrics mapped to General Ledger COAs
  const stats = useMemo(() => {
    return filtered.reduce(
      (acc, l) => {
        acc.totalDisbursed += l.disbursedAmount;
        acc.principalCOA1200 += l.coa1200Principal;
        acc.receivablesTotal += l.coa1210Interest + l.coa1220Penalties;
        if (l.daysInArrears > 30) acc.par30Exposure += l.coa1200Principal;
        return acc;
      },
      { totalDisbursed: 0, principalCOA1200: 0, receivablesTotal: 0, par30Exposure: 0 }
    );
  }, [filtered]);

  const parRatio = stats.principalCOA1200 > 0 
    ? ((stats.par30Exposure / stats.principalCOA1200) * 100).toFixed(2) 
    : "0.00";

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
            <h1 className="font-serif text-2xl text-[#1c2b22]">Loan Portfolio Report</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">
              SASRA DT-SACCO Asset Quality & General Ledger Analysis (COA 1200, 1210, 1220).
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/reports/sasra-form-4"
              className="inline-flex items-center justify-center rounded-md border border-[#c9a24b]/50 bg-[#faf6ec] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
            >
              SASRA Form 4
            </Link>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
            >
              Print Schedule
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Total Disbursed
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#1c2b22]">
              {formatCurrency(stats.totalDisbursed)}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              COA 1200 Principal
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#1c2b22]">
              {formatCurrency(stats.principalCOA1200)}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              COA 1210/1220 Receivables
            </span>
            <div className="mt-1 font-serif text-2xl font-semibold text-[#1c2b22]">
              {formatCurrency(stats.receivablesTotal)}
            </div>
          </div>

          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              PAR (&gt;30 Days) Ratio
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-2xl font-semibold text-[#8a2c2c]">
                {parRatio}%
              </span>
              <span className="text-xs text-[#9aa79f]">Target ≤ 5%</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by Loan No, Member, Voucher Ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          />
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {PRODUCT_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === "all" ? "All Loan Products" : p}
              </option>
            ))}
          </select>
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === "all"
                  ? "All SASRA Classifications"
                  : c === "performing"
                  ? "Performing (0-30d)"
                  : c === "watch"
                  ? "Watch (31-90d)"
                  : "Non-Performing (>90d)"}
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
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Member</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">COA 1200 Principal</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Receivables</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Net Ledger</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Arrears</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">SASRA Class</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading loan portfolio ledger...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#9aa79f]">
                    No loan accounts found
                  </td>
                </tr>
              ) : (
                paginated.map((l) => {
                  const netBalance = l.coa1200Principal + l.coa1210Interest + l.coa1220Penalties;
                  const sasra = getSasraClassification(l.daysInArrears);

                  return (
                    <tr key={l.id} className="hover:bg-[#eee7d6]/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1c2b22]">
                        {l.loanNumber}
                        <div className="font-sans text-[11px] font-normal text-[#4a5c50]">
                          {l.productName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#1c2b22]">
                        <div className="font-medium">{l.memberName}</div>
                        <div className="font-mono text-xs text-[#4a5c50]">{l.memberNumber}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[#1c2b22]">
                        {formatCurrency(l.coa1200Principal)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">
                        {formatCurrency(l.coa1210Interest + l.coa1220Penalties)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-[#1c2b22]">
                        {formatCurrency(netBalance)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#1c2b22]">
                        <span className={l.daysInArrears > 0 ? "font-semibold text-[#8a2c2c]" : ""}>
                          {l.daysInArrears}d
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            CLASSIFICATION_STYLES[sasra.key] ?? "bg-[#e2ddd0] text-[#4a5c50]"
                          }`}
                        >
                          {sasra.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/loans/${l.id}`}
                          className="font-medium text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#233a2c]"
                        >
                          View Ledger
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
            {filtered.length} account{filtered.length !== 1 ? "s" : ""} · Page {page} of{" "}
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