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
  created_at?: string;
  updated_at?: string;
}

function formatKES(value: string | number) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LoanProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<LoanProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/loans/products/${params.id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setError("Loan product not found.");
          return;
        }
        if (!res.ok) throw new Error("Failed to load loan product");
        const data = await res.json();
        if (!cancelled) setProduct(data.loanProduct ?? data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (params.id) load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function toggleActive() {
    if (!product) return;
    const nextState = !product.is_active;
    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/v1/loans/products/${product.loan_product_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextState }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setProduct({ ...product, is_active: nextState });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
        {/* Back link */}
        <Link
          href="/dashboard/loan-products"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[#4a5c50] hover:text-[#1c2b22]"
        >
          ← Back to loan products
        </Link>

        {loading && (
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] px-6 py-12 text-center text-[#9aa79f]">
            Loading loan product...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] px-6 py-12 text-center">
            <p className="text-sm text-[#8a2c2c]">{error}</p>
            <button
              onClick={() => router.push("/dashboard/loan-products")}
              className="mt-4 text-sm text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2"
            >
              Return to loan products
            </button>
          </div>
        )}

        {!loading && !error && product && (
          <div className="overflow-hidden rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
            {/* Passbook-style header */}
            <div className="border-b border-[#c9a24b]/30 bg-[#1c2b22] px-6 py-6 text-[#faf6ec]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#c9a24b]">
                    {product.product_code}
                  </p>
                  <h1 className="mt-1 font-serif text-2xl">{product.product_name}</h1>
                </div>
                <span
                  className={`inline-flex h-fit items-center rounded-full px-3 py-1 text-xs font-medium ${
                    product.is_active
                      ? "bg-[#e4efe6] text-[#1c2b22]"
                      : "bg-[#e2ddd0] text-[#4a5c50]"
                  }`}
                >
                  {product.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-[#c9a24b]/15">
              {/* Principal & tenure */}
              <Section title="Principal & tenure">
                <DetailRow label="Principal range">
                  {formatKES(product.min_principal)} – {formatKES(product.max_principal)}
                </DetailRow>
                <DetailRow label="Tenure">
                  {product.min_tenure_months} – {product.max_tenure_months} months
                </DetailRow>
                <DetailRow label="Max multiplier of shares">
                  {product.max_multiplier_of_shares ? `${product.max_multiplier_of_shares}×` : "—"}
                </DetailRow>
              </Section>

              {/* Interest & repayment */}
              <Section title="Interest & repayment">
                <DetailRow label="Interest rate p.a.">{product.interest_rate_pa}%</DetailRow>
                <DetailRow label="Interest method">
                  <span className="capitalize">{product.interest_method?.replace(/_/g, " ")}</span>
                </DetailRow>
                <DetailRow label="Repayment frequency">
                  <span className="capitalize">{product.repayment_frequency}</span>
                </DetailRow>
                <DetailRow label="Grace period">{product.grace_period_days} days</DetailRow>
              </Section>

              {/* Fees */}
              <Section title="Fees & penalties">
                <DetailRow label="Processing fee">{product.processing_fee_pct}%</DetailRow>
                <DetailRow label="Insurance fee">{product.insurance_fee_pct}%</DetailRow>
                <DetailRow label="Penalty rate">{product.penalty_rate_pct}%</DetailRow>
              </Section>

              {/* Requirements */}
              <Section title="Requirements">
                <DetailRow label="Guarantors required">
                  {product.requires_guarantors ? `Yes — min. ${product.min_guarantors}` : "No"}
                </DetailRow>
                <DetailRow label="Collateral required">
                  {product.requires_collateral ? "Yes" : "No"}
                </DetailRow>
              </Section>

              {/* Metadata */}
              {(product.created_at || product.updated_at) && (
                <Section title="Record">
                  {product.created_at && <DetailRow label="Created">{formatDate(product.created_at)}</DetailRow>}
                  {product.updated_at && <DetailRow label="Last updated">{formatDate(product.updated_at)}</DetailRow>}
                </Section>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 border-t border-[#c9a24b]/20 bg-[#eee7d6]/40 px-6 py-4 sm:flex-row sm:justify-end">
              <Link
                href={`/dashboard/loans/products/${product.loan_product_id}/edit`}
                className="rounded-md border border-[#c9a24b]/40 px-4 py-2 text-center text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
              >
                Edit product
              </Link>
              <button
                onClick={toggleActive}
                disabled={togglingStatus}
                className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  product.is_active
                    ? "bg-[#8a2c2c] text-[#faf6ec] hover:bg-[#732424]"
                    : "bg-[#1c2b22] text-[#faf6ec] hover:bg-[#233a2c]"
                }`}
              >
                {togglingStatus
                  ? "Updating..."
                  : product.is_active
                  ? "Deactivate product"
                  : "Activate product"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5">
      <h2 className="mb-3 font-serif text-sm uppercase tracking-wide text-[#8a6d1d]">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dotted border-[#c9a24b]/30 pb-1 sm:justify-start sm:gap-3">
      <dt className="text-xs text-[#4a5c50]">{label}</dt>
      <dd className="font-mono text-sm text-[#1c2b22]">{children}</dd>
    </div>
  );
}