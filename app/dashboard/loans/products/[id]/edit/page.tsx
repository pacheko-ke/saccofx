"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
  max_multiplier_of_shares: string | null;
  requires_guarantors: boolean;
  min_guarantors: number;
  requires_collateral: boolean;
  processing_fee_pct: string;
  insurance_fee_pct: string;
  penalty_rate_pct: string;
  grace_period_days: number;
  is_active: boolean;
}

const INTEREST_METHODS = [
  { value: "reducing_balance", label: "Reducing balance" },
  { value: "flat_rate", label: "Flat rate" },
];

const REPAYMENT_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
];

// All editable fields as strings/booleans for form control — cast on submit.
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

function toFormState(p: LoanProduct): LoanProductFormState {
  return {
    product_name: p.product_name,
    product_code: p.product_code,
    min_principal: String(p.min_principal ?? ""),
    max_principal: String(p.max_principal ?? ""),
    min_tenure_months: String(p.min_tenure_months ?? ""),
    max_tenure_months: String(p.max_tenure_months ?? ""),
    interest_rate_pa: String(p.interest_rate_pa ?? ""),
    interest_method: p.interest_method ?? "reducing_balance",
    repayment_frequency: p.repayment_frequency ?? "monthly",
    max_multiplier_of_shares: p.max_multiplier_of_shares != null ? String(p.max_multiplier_of_shares) : "",
    requires_guarantors: Boolean(p.requires_guarantors),
    min_guarantors: String(p.min_guarantors ?? "0"),
    requires_collateral: Boolean(p.requires_collateral),
    processing_fee_pct: String(p.processing_fee_pct ?? ""),
    insurance_fee_pct: String(p.insurance_fee_pct ?? ""),
    penalty_rate_pct: String(p.penalty_rate_pct ?? ""),
    grace_period_days: String(p.grace_period_days ?? "0"),
    is_active: Boolean(p.is_active),
  };
}

export default function EditLoanProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>("");

  const [form, setForm] = useState<LoanProductFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await fetch(`/api/v1/loans/products/${params.id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setLoadError("Loan product not found.");
          return;
        }
        if (!res.ok) throw new Error("Failed to load loan product");
        const data = await res.json();
        const product: LoanProduct = data.loanProduct ?? data;
        if (!cancelled) {
          setForm(toFormState(product));
          setProductName(product.product_name);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (params.id) load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function updateField<K extends keyof LoanProductFormState>(key: K, value: LoanProductFormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);

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
      const res = await fetch(`/api/v1/loans/product/${params.id}`, {
        method: "PATCH",
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
        throw new Error(body?.error ?? "Failed to update loan product");
      }

      router.push(`/dashboard/loan-products/${params.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <Link
          href={params.id ? `/dashboard/loan-products/${params.id}` : "/dashboard/loan-products"}
          className="mb-6 inline-flex items-center gap-1 text-sm text-[#4a5c50] hover:text-[#1c2b22]"
        >
          ← Back to {productName || "loan product"}
        </Link>

        {loading && (
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] px-6 py-12 text-center text-[#9aa79f]">
            Loading loan product...
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] px-6 py-12 text-center">
            <p className="text-sm text-[#8a2c2c]">{loadError}</p>
            <Link
              href="/dashboard/loan-products"
              className="mt-4 inline-block text-sm text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2"
            >
              Return to loan products
            </Link>
          </div>
        )}

        {!loading && !loadError && form && (
          <div className="overflow-hidden rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
            <div className="border-b border-[#c9a24b]/30 px-6 py-4">
              <h1 className="font-serif text-xl text-[#1c2b22]">Edit loan product</h1>
              <p className="mt-1 text-sm text-[#4a5c50]">{productName}</p>
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

                <Field label="Grace period (days)">
                  <input
                    type="number"
                    min={0}
                    value={form.grace_period_days}
                    onChange={(e) => updateField("grace_period_days", e.target.value)}
                    className={inputClass}
                  />
                </Field>

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

                <Field label="Insurance fee (%)">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.insurance_fee_pct}
                    onChange={(e) => updateField("insurance_fee_pct", e.target.value)}
                    className={inputClass}
                  />
                </Field>

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

                <label className="flex items-center gap-2 text-sm text-[#1c2b22]">
                  <input
                    type="checkbox"
                    checked={form.requires_collateral}
                    onChange={(e) => updateField("requires_collateral", e.target.checked)}
                    className="h-4 w-4 rounded border-[#c9a24b]/60 text-[#1c2b22] focus:ring-[#1c2b22]"
                  />
                  Requires collateral
                </label>

                <label className="flex items-center gap-2 text-sm text-[#1c2b22]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => updateField("is_active", e.target.checked)}
                    className="h-4 w-4 rounded border-[#c9a24b]/60 text-[#1c2b22] focus:ring-[#1c2b22]"
                  />
                  Active (available for new loan applications)
                </label>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3 border-t border-[#c9a24b]/20 pt-4">
                <Link
                  href={`/dashboard/loans/products`}
                  className="rounded-md border border-[#c9a24b]/40 px-4 py-2 text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
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