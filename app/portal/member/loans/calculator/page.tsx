"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CalcMethod = "reducing" | "flat";

interface LoanProduct {
  loan_product_id: string;
  product_name: string;
  interest_rate: number;
  interest_method: CalcMethod;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
}

interface ScheduleRow {
  period: number;
  openingBalance: number;
  installment: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

const inputClasses =
  "w-full rounded-md border border-[#c9a24b]/40 bg-white px-3.5 py-2.5 text-[15px] text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#1c2b22]/15 transition-colors";
const labelClasses = "mb-1.5 block text-[13px] font-medium text-[#4a5c50]";

function formatKES(amount: number) {
  if (!Number.isFinite(amount)) return "KES 0.00";
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildReducingBalanceSchedule(principal: number, annualRatePct: number, termMonths: number): ScheduleRow[] {
  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  const installment = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let period = 1; period <= n; period++) {
    const interest = balance * r;
    let principalPortion = installment - interest;
    let closing = balance - principalPortion;

    if (period === n) {
      principalPortion = balance;
      closing = 0;
    }

    rows.push({
      period,
      openingBalance: balance,
      installment: period === n ? principalPortion + interest : installment,
      interest,
      principal: principalPortion,
      closingBalance: closing,
    });

    balance = closing;
  }

  return rows;
}

function buildFlatRateSchedule(principal: number, annualRatePct: number, termMonths: number): ScheduleRow[] {
  const totalInterest = principal * (annualRatePct / 100) * (termMonths / 12);
  const principalPerPeriod = principal / termMonths;
  const interestPerPeriod = totalInterest / termMonths;
  const installment = principalPerPeriod + interestPerPeriod;

  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let period = 1; period <= termMonths; period++) {
    const closing = period === termMonths ? 0 : balance - principalPerPeriod;
    rows.push({
      period,
      openingBalance: balance,
      installment,
      interest: interestPerPeriod,
      principal: period === termMonths ? balance : principalPerPeriod,
      closingBalance: closing,
    });
    balance = closing;
  }

  return rows;
}

function approximateFlatRateAPR(annualRatePct: number): number {
  return annualRatePct * 1.8;
}

export default function LoanCalculatorPage() {
  const router = useRouter();

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const [amount, setAmount] = useState("100000");
  const [rate, setRate] = useState("12");
  const [term, setTerm] = useState("12");
  const [method, setMethod] = useState<CalcMethod>("reducing");
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoadingProducts(true);
      setLoadError("");
      try {
        const res = await fetch("/api/v1/member/loans/products");
        if (!res.ok) throw new Error("Failed to load loan products");
        const data = await res.json();
        if (cancelled) return;

        const list: LoanProduct[] = data.products ?? [];
        setProducts(list);

        if (list.length > 0) {
          applyProduct(list[0]);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyProduct(product: LoanProduct) {
    setSelectedProductId(product.loan_product_id);
    setRate(String(product.interest_rate));
    setMethod(product.interest_method);
    // Clamp the current amount/term into the product's allowed range
    // rather than silently overwriting whatever the member had typed.
    setAmount((prev) => {
      const n = Number(prev) || product.min_amount;
      return String(Math.min(Math.max(n, product.min_amount), product.max_amount));
    });
    setTerm((prev) => {
      const n = Number(prev) || product.min_term_months;
      return String(Math.min(Math.max(n, product.min_term_months), product.max_term_months));
    });
  }

  const selectedProduct = products.find((p) => p.loan_product_id === selectedProductId);

  const principal = Number(amount) || 0;
  const annualRate = Number(rate) || 0;
  const termMonths = Number(term) || 0;

  const withinProductLimits =
    !selectedProduct ||
    (principal >= selectedProduct.min_amount &&
      principal <= selectedProduct.max_amount &&
      termMonths >= selectedProduct.min_term_months &&
      termMonths <= selectedProduct.max_term_months);

  const isValid = principal > 0 && annualRate >= 0 && termMonths > 0 && termMonths <= 360 && withinProductLimits;

  const schedule = useMemo(() => {
    if (!isValid) return [];
    return method === "reducing"
      ? buildReducingBalanceSchedule(principal, annualRate, termMonths)
      : buildFlatRateSchedule(principal, annualRate, termMonths);
  }, [isValid, method, principal, annualRate, termMonths]);

  const totals = useMemo(() => {
    if (schedule.length === 0) return { installment: 0, totalInterest: 0, totalRepayment: 0 };
    const totalInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    const totalPrincipal = schedule.reduce((sum, r) => sum + r.principal, 0);
    return {
      installment: schedule[0].installment,
      totalInterest,
      totalRepayment: totalPrincipal + totalInterest,
    };
  }, [schedule]);

  function handleApply() {
    if (!isValid) return;

    // Hands the calculated inputs off to the loan application flow as
    // query params so the form can pre-fill rather than making the member
    // re-enter everything. Adjust the target path to wherever your actual
    // application page lives.
    const params = new URLSearchParams({
      amount: String(principal),
      termMonths: String(termMonths),
      ...(selectedProduct ? { productId: selectedProduct.loan_product_id } : {}),
    });
    router.push(`/portal/member/loans/apply?${params.toString()}`);
  }

  return (
    <div className="mx-4 mt-14 overflow-hidden rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec]">
      <div className="border-b border-[#c9a24b]/30 px-6 py-5 sm:px-8 print:hidden">
        <h1 className="font-serif text-xl text-[#1c2b22] sm:text-2xl">Loan calculator</h1>
        <p className="mt-1 text-sm text-[#4a5c50]">
          Estimate your monthly installment and full repayment schedule before applying.
        </p>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {loadError && (
          <p className="mb-4 rounded-md bg-[#f4dede] px-3 py-2 text-sm text-[#8a2c2c]">
            {loadError} — you can still calculate manually below using a custom rate.
          </p>
        )}

        {/* Product picker */}
        {!loadingProducts && products.length > 0 && (
          <div className="mb-5 print:hidden">
            <p className={labelClasses}>Loan product</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {products.map((p) => (
                <button
                  key={p.loan_product_id}
                  type="button"
                  onClick={() => applyProduct(p)}
                  className={`rounded-md border px-4 py-3 text-left transition-colors ${
                    selectedProductId === p.loan_product_id
                      ? "border-[#1c2b22] bg-[#e4efe6]"
                      : "border-[#c9a24b]/40 bg-white hover:bg-[#eee7d6]"
                  }`}
                >
                  <p className="text-sm font-medium text-[#1c2b22]">{p.product_name}</p>
                  <p className="mt-0.5 text-xs text-[#4a5c50]">
                    {p.interest_rate}% p.a. · {p.interest_method === "reducing" ? "Reducing balance" : "Flat rate"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#4a5c50]">
                    {formatKES(p.min_amount)} – {formatKES(p.max_amount)} · {p.min_term_months}–{p.max_term_months}
                    mo
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inputs */}
        <div className="rounded-md border border-[#c9a24b]/30 bg-white p-5 print:hidden">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label className={labelClasses}>Loan amount (KES)</label>
              <input
                className={inputClasses}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="e.g. 100000"
              />
            </div>
            <div>
              <label className={labelClasses}>Interest rate (% p.a.)</label>
              <input
                className={inputClasses}
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
                disabled={!!selectedProduct}
                inputMode="decimal"
                placeholder="e.g. 12"
              />
            </div>
            <div>
              <label className={labelClasses}>Loan term (months)</label>
              <input
                className={inputClasses}
                value={term}
                onChange={(e) => setTerm(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 12"
              />
            </div>
          </div>

          {!selectedProduct && (
            <div className="mt-5">
              <label className={labelClasses}>Calculation method</label>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                {[
                  { value: "reducing" as const, label: "Reducing balance", hint: "Interest on outstanding balance" },
                  { value: "flat" as const, label: "Flat rate", hint: "Interest on original amount" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMethod(opt.value)}
                    className={`rounded-md border px-4 py-3 text-left transition-colors ${
                      method === opt.value
                        ? "border-[#1c2b22] bg-[#e4efe6] text-[#1c2b22]"
                        : "border-[#c9a24b]/40 text-[#4a5c50] hover:bg-[#eee7d6]"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-[#4a5c50]">{opt.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isValid && principal > 0 && termMonths > 0 && !withinProductLimits && selectedProduct && (
            <p className="mt-4 text-xs text-red-600">
              {selectedProduct.product_name} allows {formatKES(selectedProduct.min_amount)}–
              {formatKES(selectedProduct.max_amount)} over {selectedProduct.min_term_months}–
              {selectedProduct.max_term_months} months. Adjust the amount or term to match.
            </p>
          )}
          {!isValid && (principal <= 0 || termMonths <= 0) && (
            <p className="mt-4 text-xs text-red-600">
              Enter a loan amount greater than 0 and a term between 1 and 360 months.
            </p>
          )}

          {method === "flat" && isValid && (
            <p className="mt-4 rounded-md bg-[#f3e6c8] px-3 py-2 text-xs text-[#7a5c1e]">
              A flat rate of {annualRate}% works out to roughly {approximateFlatRateAPR(annualRate).toFixed(1)}%
              on a reducing-balance basis — flat rates look lower but cost more over the life of the loan.
            </p>
          )}
        </div>

        {/* Summary */}
        {isValid && (
          <>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[#c9a24b]/30 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5c50]">
                  Monthly installment
                </p>
                <p className="mt-1.5 font-mono text-xl text-[#1c2b22]">{formatKES(totals.installment)}</p>
              </div>
              <div className="rounded-md border border-[#c9a24b]/30 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5c50]">Total interest</p>
                <p className="mt-1.5 font-mono text-xl text-[#1c2b22]">{formatKES(totals.totalInterest)}</p>
              </div>
              <div className="rounded-md border border-[#c9a24b]/30 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5c50]">
                  Total repayment
                </p>
                <p className="mt-1.5 font-mono text-xl text-[#1c2b22]">{formatKES(totals.totalRepayment)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden">
              <button
                type="button"
                onClick={handleApply}
                className="rounded-md bg-[#1c2b22] px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition-colors hover:bg-[#233a2c]"
              >
                Apply for this loan
              </button>
              <button
                type="button"
                onClick={() => setShowSchedule((s) => !s)}
                className="text-sm font-medium text-[#1c2b22] hover:underline"
              >
                {showSchedule ? "Hide" : "Show"} repayment schedule
              </button>
              {showSchedule && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-md border border-[#c9a24b]/40 px-3.5 py-1.5 text-xs font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
                >
                  ⎙ Print schedule
                </button>
              )}
            </div>

            {showSchedule && (
              <div className="mt-3 overflow-hidden rounded-md border border-[#c9a24b]/30 bg-white print:border-0">
                <div className="max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-[#eee7d6] text-left print:static">
                      <tr>
                        <th className="px-3 py-2 font-medium text-[#1c2b22]">#</th>
                        <th className="px-3 py-2 text-right font-medium text-[#1c2b22]">Opening balance</th>
                        <th className="px-3 py-2 text-right font-medium text-[#1c2b22]">Installment</th>
                        <th className="px-3 py-2 text-right font-medium text-[#1c2b22]">Interest</th>
                        <th className="px-3 py-2 text-right font-medium text-[#1c2b22]">Principal</th>
                        <th className="px-3 py-2 text-right font-medium text-[#1c2b22]">Closing balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c9a24b]/15">
                      {schedule.map((row) => (
                        <tr key={row.period}>
                          <td className="px-3 py-2 text-[#4a5c50]">{row.period}</td>
                          <td className="px-3 py-2 text-right font-mono text-[#1c2b22]">
                            {formatKES(row.openingBalance)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[#1c2b22]">
                            {formatKES(row.installment)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[#4a5c50]">
                            {formatKES(row.interest)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[#4a5c50]">
                            {formatKES(row.principal)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[#1c2b22]">
                            {formatKES(row.closingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}