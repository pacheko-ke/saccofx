"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GuarantorStep, { Guarantor } from "@/app/components/loans/GuarantorStep";
import OtpVerifyModal from "@/app/components/loans/OtpVerifyModal";

const STEPS = ["Loan details", "Guarantors", "Review", "Confirm & submit"] as const;
type Step = (typeof STEPS)[number];

interface LoanDetails {
  loanProductId: string;
  amountRequested: string;
  termMonths: string;
  purpose: string;
}

interface LoanProduct {
  loan_product_id: string;
  product_name: string;
  min_principal: number;
  max_principal: number;
  min_tenure_months: number;
  max_tenure_months: number;
}

// TODO: replace with the signed-in member's real details once auth/session is wired in
const CURRENT_MEMBER = {
  id: "member-placeholder-id",
  fullName: "Applicant Name",
  phone: "+254712345678",
  email: "applicant@example.com",
};

// useSearchParams requires a Suspense boundary in the app router, since
// reading query params opts the page out of static rendering.
export default function LoanApplicationPageWrapper() {
  return (
    <Suspense fallback={null}>
      <LoanApplicationPage />
    </Suspense>
  );
}

function LoanApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  // Pre-fill straight from the calculator's query params on first render —
  // this covers the case where the member arrived via "Apply for this
  // loan" with amount/termMonths/productId already chosen.
  const [loanDetails, setLoanDetails] = useState<LoanDetails>(() => ({
    loanProductId: searchParams.get("productId") ?? "",
    amountRequested: searchParams.get("amount") ?? "",
    termMonths: searchParams.get("termMonths") ?? "",
    purpose: "",
  }));
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loanDetailsError, setLoanDetailsError] = useState("");

  const [applicantOtpOpen, setApplicantOtpOpen] = useState(false);
  const [applicantOtpVerified, setApplicantOtpVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductsError("");
      try {
        const res = await fetch("/api/v1/members/loans/products");
        if (!res.ok) throw new Error("Failed to load loan products");
        const data = await res.json();
        if (!cancelled) {
          const list: LoanProduct[] = data.products ?? [];
          setProducts(list);

          // If the calculator handed off a productId that isn't in the
          // list (deactivated product, typo, stale link), clear it rather
          // than silently carrying an invalid selection into submission.
          const incomingId = searchParams.get("productId");
          if (incomingId && !list.some((p) => p.loan_product_id === incomingId)) {
            setLoanDetails((d) => ({ ...d, loanProductId: "" }));
          }
        }
      } catch (err) {
        if (!cancelled) setProductsError(err instanceof Error ? err.message : "Something went wrong");
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

  function goNext() {
    if (step === "Loan details") {
      if (!loanDetails.loanProductId) return setLoanDetailsError("Select a loan product.");
      const amount = Number(loanDetails.amountRequested);
      if (!amount || amount <= 0) return setLoanDetailsError("Enter a valid amount.");
      const term = Number(loanDetails.termMonths);
      if (!term || term <= 0) return setLoanDetailsError("Enter a valid repayment term.");

      const product = products.find((p) => p.loan_product_id === loanDetails.loanProductId);
      if (product) {
        if (amount < product.min_principal || amount > product.max_principal) {
          return setLoanDetailsError(
            `${product.product_name} allows KES ${product.min_principal.toLocaleString()}–${product.max_principal.toLocaleString()}.`
          );
        }
        if (term < product.min_tenure_months || term > product.max_tenure_months) {
          return setLoanDetailsError(
            `${product.product_name} allows a term of ${product.min_tenure_months}–${product.max_tenure_months} months.`
          );
        }
      }

      if (!loanDetails.purpose.trim()) return setLoanDetailsError("Tell us the purpose of this loan.");
      setLoanDetailsError("");
    }
    if (step === "Guarantors" && guarantors.length === 0) {
      return; // button is disabled in this case, but guard anyway
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/loans/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: CURRENT_MEMBER.id,
          loanProductId: loanDetails.loanProductId,
          amountRequested: Number(loanDetails.amountRequested),
          termMonths: Number(loanDetails.termMonths),
          purpose: loanDetails.purpose,
          guarantors: guarantors.map((g) => ({
            fullName: g.fullName,
            phone: g.phone,
            nationalId: g.nationalId,
            relationship: g.relationship,
            guaranteedAmount: g.guaranteedAmount,
            verified: g.verified,
          })),
          applicantOtpVerified,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong submitting your application.");
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError("Something went wrong submitting your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => p.loan_product_id === loanDetails.loanProductId);

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto  max-w-3xl px-4 py-10">
        <h1 className="font-serif text-2xl text-[#1c2b22]">Loan application</h1>
        <p className="mt-1 text-sm text-[#4a5c50]">saccofx pro · Complete every step to submit your request.</p>

        {/* Stepper */}
        <ol className="mt-8 mb-8 flex items-center">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    i <= stepIndex ? "bg-[#1c2b22] text-[#faf6ec]" : "bg-[#d8cfb4] text-[#4a5c50]"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    i <= stepIndex ? "text-[#1c2b22]" : "text-[#9aa79f]"
                  }`}
                >
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span className={`mx-3 h-px flex-1 ${i < stepIndex ? "bg-[#1c2b22]" : "bg-[#d8cfb4]"}`} />
              )}
            </li>
          ))}
        </ol>

        <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-6 shadow-sm">
          {/* Step 1: Loan details */}
          {step === "Loan details" && (
            <div>
              <h2 className="font-serif text-xl text-[#1c2b22]">Loan details</h2>
              <p className="mt-1 text-sm text-[#4a5c50]">Tell us what you'd like to borrow.</p>

              {productsError && (
                <p className="mt-3 rounded-md bg-[#f4dede] px-3 py-2 text-sm text-[#8a2c2c]">{productsError}</p>
              )}

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Loan product</label>
                  <select
                    value={loanDetails.loanProductId}
                    onChange={(e) => setLoanDetails((d) => ({ ...d, loanProductId: e.target.value }))}
                    disabled={loadingProducts}
                    className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none disabled:opacity-60"
                  >
                    <option value="">{loadingProducts ? "Loading products…" : "Select a loan product"}</option>
                    {products.map((p) => (
                      <option key={p.loan_product_id} value={p.loan_product_id}>
                        {p.product_name}
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-[#4a5c50]">
                      KES {selectedProduct.min_principal.toLocaleString()}–
                      {selectedProduct.max_principal.toLocaleString()} · {selectedProduct.min_tenure_months}–
                      {selectedProduct.max_tenure_months} months
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Amount (KES)</label>
                    <input
                      value={loanDetails.amountRequested}
                      onChange={(e) =>
                        setLoanDetails((d) => ({ ...d, amountRequested: e.target.value.replace(/[^\d]/g, "") }))
                      }
                      inputMode="numeric"
                      className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                      placeholder="150000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Term (months)</label>
                    <input
                      value={loanDetails.termMonths}
                      onChange={(e) =>
                        setLoanDetails((d) => ({ ...d, termMonths: e.target.value.replace(/[^\d]/g, "") }))
                      }
                      inputMode="numeric"
                      className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                      placeholder="12"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Purpose of loan</label>
                  <textarea
                    value={loanDetails.purpose}
                    onChange={(e) => setLoanDetails((d) => ({ ...d, purpose: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                    placeholder="E.g. purchasing dairy equipment for the family farm"
                  />
                </div>
              </div>

              {loanDetailsError && <p className="mt-3 text-sm text-red-600">{loanDetailsError}</p>}
            </div>
          )}

          {/* Step 2: Guarantors */}
          {step === "Guarantors" && <GuarantorStep guarantors={guarantors} onChange={setGuarantors} />}

          {/* Step 3: Review */}
          {step === "Review" && (
            <div>
              <h2 className="font-serif text-xl text-[#1c2b22]">Review your application</h2>
              <p className="mt-1 text-sm text-[#4a5c50]">Check everything below before you submit.</p>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Loan product</dt>
                  <dd className="font-medium text-[#1c2b22]">{selectedProduct?.product_name}</dd>
                </div>
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Amount requested</dt>
                  <dd className="font-medium text-[#1c2b22]">
                    KES {Number(loanDetails.amountRequested || 0).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Term</dt>
                  <dd className="font-medium text-[#1c2b22]">{loanDetails.termMonths} months</dd>
                </div>
                <div className="border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Purpose</dt>
                  <dd className="mt-1 text-[#1c2b22]">{loanDetails.purpose}</dd>
                </div>
                <div>
                  <dt className="mb-2 text-[#4a5c50]">Guarantors ({guarantors.length})</dt>
                  <dd className="space-y-1">
                    {guarantors.map((g, i) => (
                      <div key={g.id} className="text-[#1c2b22]">
                        {i + 1}. {g.fullName} — {g.phone} — KES {g.guaranteedAmount.toLocaleString()}
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Step 4: Confirm & submit */}
          {step === "Confirm & submit" && (
            <div>
              {!submitted ? (
                <>
                  <h2 className="font-serif text-xl text-[#1c2b22]">Confirm it's you</h2>
                  <p className="mt-1 text-sm text-[#4a5c50]">
                    As a final security step, confirm the one-time code sent to your registered phone number before
                    we submit your application.
                  </p>

                  <div className="mt-5 rounded-md bg-[#e4efe6] px-4 py-3 text-sm text-[#1c2b22]">
                    {applicantOtpVerified ? (
                      <span>✓ Identity confirmed — ready to submit.</span>
                    ) : (
                      <span>Registered phone: {CURRENT_MEMBER.phone}</span>
                    )}
                  </div>

                  {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

                  {!applicantOtpVerified ? (
                    <button
                      type="button"
                      onClick={() => setApplicantOtpOpen(true)}
                      className="mt-5 rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
                    >
                      Send confirmation code
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={submitting}
                      className="mt-5 rounded-md bg-[#c9a24b] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#b5903f] disabled:opacity-60"
                    >
                      {submitting ? "Submitting..." : "Submit loan application"}
                    </button>
                  )}
                </>
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e4efe6] text-2xl">
                    ✓
                  </div>
                  <h2 className="font-serif text-xl text-[#1c2b22]">Application submitted</h2>
                  <p className="mt-1 text-sm text-[#4a5c50]">
                    Your loan application has been sent for committee review. You'll be notified once a decision has
                    been made.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/loans")}
                    className="mt-5 rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
                  >
                    Back to loans
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        {!(step === "Confirm & submit" && submitted) && (
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="rounded-md px-4 py-2 text-sm font-medium text-[#4a5c50] hover:bg-[#e2dac2] disabled:opacity-0"
            >
              Back
            </button>
            {step !== "Confirm & submit" && (
              <button
                type="button"
                onClick={goNext}
                disabled={step === "Guarantors" && guarantors.length === 0}
                className="rounded-md bg-[#1c2b22] px-5 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-40"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>

      <OtpVerifyModal
        open={applicantOtpOpen}
        purpose="applicant_confirmation"
        identifier={CURRENT_MEMBER.phone}
        title="Confirm your identity"
        onClose={() => setApplicantOtpOpen(false)}
        onVerified={() => {
          setApplicantOtpVerified(true);
          setApplicantOtpOpen(false);
        }}
      />
    </div>
  );
}