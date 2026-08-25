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

const INTEREST_METHODS = [
  { value: "reducing_balance", label: "Reducing balance" },
  { value: "flat_rate", label: "Flat rate" },
];

const REPAYMENT_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
];

// Shape of the create-form. Kept separate from LoanProduct since numeric
// fields are edited as strings in inputs and cast on submit.
interface LoanProductFormState {
  product_name: string;
  product_code: string;
  min_principal: string;
  max_principal: string;
  min_tenure_months: string;
  max_tenure_months: string;
  interest_rate_pa: string;
  interest_method: string;
  repayment_frequency: string;
  max_multiplier_of_shares: string;
  requires_guarantors: boolean;
  min_guarantors: string;
  requires_collateral: boolean;
  processing_fee_pct: string;
  insurance_fee_pct: string;
  penalty_rate_pct: string;
  grace_period_days: string;
  is_active: boolean;
}

const EMPTY_FORM: LoanProductFormState = {
  product_name: "",
  product_code: "",
  min_principal: "",
  max_principal: "",
  min_tenure_months: "",
  max_tenure_months: "",
  interest_rate_pa: "",
  interest_method: "reducing_balance",
  repayment_frequency: "monthly",
  max_multiplier_of_shares: "",
  requires_guarantors: false,
  min_guarantors: "0",
  requires_collateral: false,
  processing_fee_pct: "",
  insurance_fee_pct: "",
  penalty_rate_pct: "",
  grace_period_days: "0",
  is_active: true,
};

export default function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LoanProductFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/loans/products");
      if (!res.ok) throw new Error("Failed to load loan products");
      const data = await res.json();
      setProducts(data.loanProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
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

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    if (submitting) return; // don't allow closing mid-submit
    setShowModal(false);
  }

  function updateField<K extends keyof LoanProductFormState>(key: K, value: LoanProductFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Minimal client-side sanity checks before hitting the API
    if (!form.product_name.trim() || !form.product_code.trim()) {
      setFormError("Product name and code are required.");
      return;
    }
    const minPrincipal = Number(form.min_principal);
    const maxPrincipal = Number(form.max_principal);
    if (!form.min_principal || !form.max_principal || maxPrincipal < minPrincipal) {
      setFormError("Enter a valid principal range (max must be ≥ min).");
      return;
    }
    const minTenure = Number(form.min_tenure_months);
    const maxTenure = Number(form.max_tenure_months);
    if (!form.min_tenure_months || !form.max_tenure_months || maxTenure < minTenure) {
      setFormError("Enter a valid tenure range (max must be ≥ min).");
      return;
    }
    if (!form.interest_rate_pa) {
      setFormError("Interest rate p.a. is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/loans/products/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: form.product_name.trim(),
          product_code: form.product_code.trim(),
          min_principal: minPrincipal,
          max_principal: maxPrincipal,
          min_tenure_months: minTenure,
          max_tenure_months: maxTenure,
          interest_rate_pa: Number(form.interest_rate_pa),
          interest_method: form.interest_method,
          repayment_frequency: form.repayment_frequency,
          max_multiplier_of_shares: form.max_multiplier_of_shares
            ? Number(form.max_multiplier_of_shares)
            : null,
          requires_guarantors: form.requires_guarantors,
          min_guarantors: form.requires_guarantors ? Number(form.min_guarantors || 0) : 0,
          requires_collateral: form.requires_collateral,
          processing_fee_pct: form.processing_fee_pct ? Number(form.processing_fee_pct) : 0,
          insurance_fee_pct: form.insurance_fee_pct ? Number(form.insurance_fee_pct) : 0,
          penalty_rate_pct: form.penalty_rate_pct ? Number(form.penalty_rate_pct) : 0,
          grace_period_days: Number(form.grace_period_days || 0),
          is_active: form.is_active,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create loan product");
      }

      setShowModal(false);
      await loadProducts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#1c2b22]">Loan products</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">Catalogue of loan products offered by the SACCO.</p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
          >
            + New Loan Product
          </button>
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

      {/* New Loan Product modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/50 px-4 py-8"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#c9a24b]/40 bg-[#faf6ec] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#c9a24b]/30 px-6 py-4">
              <h2 className="font-serif text-lg text-[#1c2b22]">New Loan Product</h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="text-[#4a5c50] hover:text-[#1c2b22] disabled:opacity-40"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              {formError && (
                <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Product name" required>
                  <input
                    type="text"
                    value={form.product_name}
                    onChange={(e) => updateField("product_name", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Development Loan"
                  />
                </Field>

                <Field label="Product code" required>
                  <input
                    type="text"
                    value={form.product_code}
                    onChange={(e) => updateField("product_code", e.target.value.toUpperCase())}
                    className={`${inputClass} font-mono`}
                    placeholder="e.g. DEV-01"
                  />
                </Field>

                <Field label="Min principal (KES)" required>
                  <input
                    type="number"
                    min={0}
                    value={form.min_principal}
                    onChange={(e) => updateField("min_principal", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Max principal (KES)" required>
                  <input
                    type="number"
                    min={0}
                    value={form.max_principal}
                    onChange={(e) => updateField("max_principal", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Min tenure (months)" required>
                  <input
                    type="number"
                    min={1}
                    value={form.min_tenure_months}
                    onChange={(e) => updateField("min_tenure_months", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Max tenure (months)" required>
                  <input
                    type="number"
                    min={1}
                    value={form.max_tenure_months}
                    onChange={(e) => updateField("max_tenure_months", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Interest rate p.a. (%)" required>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.interest_rate_pa}
                    onChange={(e) => updateField("interest_rate_pa", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Interest method">
                  <select
                    value={form.interest_method}
                    onChange={(e) => updateField("interest_method", e.target.value)}
                    className={inputClass}
                  >
                    {INTEREST_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Repayment frequency">
                  <select
                    value={form.repayment_frequency}
                    onChange={(e) => updateField("repayment_frequency", e.target.value)}
                    className={inputClass}
                  >
                    {REPAYMENT_FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Max multiplier of shares">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={form.max_multiplier_of_shares}
                    onChange={(e) => updateField("max_multiplier_of_shares", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 2.5"
                  />
                </Field>

                {/* <Field label="Grace period (days)">
                  <input
                    type="number"
                    min={0}
                    value={form.grace_period_days}
                    onChange={(e) => updateField("grace_period_days", e.target.value)}
                    className={inputClass}
                  />
                </Field> */}

                <Field label="Processing fee (%)">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.processing_fee_pct}
                    onChange={(e) => updateField("processing_fee_pct", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                {/* <Field label="Insurance fee (%)">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.insurance_fee_pct}
                    onChange={(e) => updateField("insurance_fee_pct", e.target.value)}
                    className={inputClass}
                  />
                </Field> */}

                <Field label="Penalty rate (%)">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.penalty_rate_pct}
                    onChange={(e) => updateField("penalty_rate_pct", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* Toggles */}
              <div className="mt-5 space-y-3 border-t border-[#c9a24b]/20 pt-4">
                <label className="flex items-center gap-2 text-sm text-[#1c2b22]">
                  <input
                    type="checkbox"
                    checked={form.requires_guarantors}
                    onChange={(e) => updateField("requires_guarantors", e.target.checked)}
                    className="h-4 w-4 rounded border-[#c9a24b]/60 text-[#1c2b22] focus:ring-[#1c2b22]"
                  />
                  Requires guarantors
                </label>

                {form.requires_guarantors && (
                  <div className="ml-6 max-w-[200px]">
                    <Field label="Min guarantors">
                      <input
                        type="number"
                        min={1}
                        value={form.min_guarantors}
                        onChange={(e) => updateField("min_guarantors", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}

                {/* <label className="flex items-center gap-2 text-sm text-[#1c2b22]">
                  <input
                    type="checkbox"
                    checked={form.requires_collateral}
                    onChange={(e) => updateField("requires_collateral", e.target.checked)}
                    className="h-4 w-4 rounded border-[#c9a24b]/60 text-[#1c2b22] focus:ring-[#1c2b22]"
                  />
                  Requires collateral
                </label> */}

                {/* <label className="flex items-center gap-2 text-sm text-[#1c2b22]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => updateField("is_active", e.target.checked)}
                    className="h-4 w-4 rounded border-[#c9a24b]/60 text-[#1c2b22] focus:ring-[#1c2b22]"
                  />
                  Active (available for new loan applications)
                </label> */}
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3 border-t border-[#c9a24b]/20 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-md border border-[#c9a24b]/40 px-4 py-2 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create loan product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#4a5c50]">
        {label}
        {required && <span className="text-[#8a2c2c]"> *</span>}
      </span>
      {children}
    </label>
  );
}