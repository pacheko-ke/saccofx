"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GuarantorStep, { Guarantor } from "@/app/components/loans/GuarantorStep";
import Sidebar from "@/app/components/SideBar";

const STEPS = ["Loan details", "Guarantors", "Review", "Submit"] as const;
type Step = (typeof STEPS)[number];

interface LoanDetails {
  loanProductId: string;
  amountRequested: string;
  termMonths: string;
  purpose: string;
}

interface LoanProduct {
  id: string;
  name: string;
  /** Minimum number of guarantors required for this loan product */
  minGuarantors: number;
}

// NOTE: minGuarantors here should ideally mirror whatever is configured
// server-side for each loan product (e.g. a `min_guarantors` column on
// loan_products). Keep this in sync, or better, fetch it from
// /api/loans/products so the rule lives in one place.
const LOAN_PRODUCTS: LoanProduct[] = [
  { id: "dev-loan", name: "Development Loan", minGuarantors: 2 },
  { id: "emergency-loan", name: "Emergency Loan", minGuarantors: 1 },
  { id: "school-fees-loan", name: "School Fees Loan", minGuarantors: 1 },
  { id: "asset-finance-loan", name: "Asset Finance Loan", minGuarantors: 3 },
];

// TODO: replace with the signed-in member's real details once auth/session is wired in
const CURRENT_MEMBER = {
  id: "member-placeholder-id",
  fullName: "Applicant Name",
  phone: "+254712345678",
  email: "applicant@example.com",
};

export default function LoanApplicationPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const [loanDetails, setLoanDetails] = useState<LoanDetails>({
    loanProductId: "",
    amountRequested: "",
    termMonths: "",
    purpose: "",
  });
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loanDetailsError, setLoanDetailsError] = useState("");
  const [guarantorError, setGuarantorError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedProduct = LOAN_PRODUCTS.find((p) => p.id === loanDetails.loanProductId);
  const requiredGuarantors = selectedProduct?.minGuarantors ?? 1;
  const guarantorsSatisfied = guarantors.length >= requiredGuarantors;

  function goNext() {
    if (step === "Loan details") {
      if (!loanDetails.loanProductId) return setLoanDetailsError("Select a loan product.");
      const amount = Number(loanDetails.amountRequested);
      if (!amount || amount <= 0) return setLoanDetailsError("Enter a valid amount.");
      const term = Number(loanDetails.termMonths);
      if (!term || term <= 0) return setLoanDetailsError("Enter a valid repayment term.");
      if (!loanDetails.purpose.trim()) return setLoanDetailsError("Tell us the purpose of this loan.");
      setLoanDetailsError("");
    }
    if (step === "Guarantors") {
      if (!guarantorsSatisfied) {
        setGuarantorError(
          `${selectedProduct?.name ?? "This loan product"} requires at least ${requiredGuarantors} guarantor${
            requiredGuarantors === 1 ? "" : "s"
          }. You've added ${guarantors.length}.`
        );
        return; // button is disabled in this case too, but guard anyway
      }
      setGuarantorError("");
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
      const res = await fetch("/api/v1/loans/applications", {
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
          })),
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

  return (
<>
    <Sidebar></Sidebar>
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-2xl text-[#1c2b22]">Loan application</h1>
        <p className="mt-1 text-sm text-[#4a5c50]">SaccoFX Pro · Complete every step to submit your request.</p>

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

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Loan product</label>
                  <select
                    value={loanDetails.loanProductId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setLoanDetails((d) => ({ ...d, loanProductId: nextId }));
                      // Loan product changed: previously entered guarantors may no
                      // longer satisfy the new product's requirement, so clear
                      // any stale error and let the Guarantors step re-check.
                      setGuarantorError("");
                    }}
                    className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                  >
                    <option value="">Select a loan product</option>
                    {LOAN_PRODUCTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-[#4a5c50]">
                      Requires at least {selectedProduct.minGuarantors} guarantor
                      {selectedProduct.minGuarantors === 1 ? "" : "s"}.
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
          {step === "Guarantors" && (
            <div>
              <div className="mb-4 flex items-center justify-between rounded-md bg-[#e4efe6] px-4 py-3 text-sm text-[#1c2b22]">
                <span>
                  {selectedProduct?.name ?? "This loan product"} requires at least{" "}
                  <strong>{requiredGuarantors}</strong> guarantor{requiredGuarantors === 1 ? "" : "s"}.
                </span>
                <span className={guarantorsSatisfied ? "font-medium text-[#1c2b22]" : "font-medium text-red-600"}>
                  {guarantors.length} / {requiredGuarantors} added
                </span>
              </div>

              <GuarantorStep
                guarantors={guarantors}
                onChange={(next) => {
                  setGuarantors(next);
                  if (next.length >= requiredGuarantors) setGuarantorError("");
                }}
                minRequired={requiredGuarantors}
              />

              <p className="mt-3 text-xs text-[#4a5c50]">
                Each guarantor will get an in-app notification on their SaccoFX Pro account asking them to approve
                guaranteeing this loan. No OTP is needed here — approval happens on their end.
              </p>

              {guarantorError && <p className="mt-3 text-sm text-red-600">{guarantorError}</p>}
            </div>
          )}

          {/* Step 3: Review */}
          {step === "Review" && (
            <div>
              <h2 className="font-serif text-xl text-[#1c2b22]">Review your application</h2>
              <p className="mt-1 text-sm text-[#4a5c50]">Check everything below before you submit.</p>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Loan product</dt>
                  <dd className="font-medium text-[#1c2b22]">{selectedProduct?.name}</dd>
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
                  <dt className="mb-2 text-[#4a5c50]">
                    Guarantors ({guarantors.length} / {requiredGuarantors} required)
                  </dt>
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

          {/* Step 4: Submit */}
          {step === "Submit" && (
            <div>
              {!submitted ? (
                <>
                  <h2 className="font-serif text-xl text-[#1c2b22]">Ready to submit</h2>
                  <p className="mt-1 text-sm text-[#4a5c50]">
                    Once you submit, each guarantor listed above will receive a notification on their SaccoFX Pro
                    account asking them to approve guaranteeing this loan. Your application moves to committee
                    review once all guarantors have approved.
                  </p>

                  {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="mt-5 rounded-md bg-[#c9a24b] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#b5903f] disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit loan application"}
                  </button>
                </>
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e4efe6] text-2xl">
                    ✓
                  </div>
                  <h2 className="font-serif text-xl text-[#1c2b22]">Application submitted</h2>
                  <p className="mt-1 text-sm text-[#4a5c50]">
                    Your guarantors have been notified and need to approve on their end before this goes to
                    committee review. You'll be notified once a decision has been made.
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
        {!(step === "Submit" && submitted) && (
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="rounded-md px-4 py-2 text-sm font-medium text-[#4a5c50] hover:bg-[#e2dac2] disabled:opacity-0"
            >
              Back
            </button>
            {step !== "Submit" && (
              <button
                type="button"
                onClick={goNext}
                disabled={step === "Guarantors" && !guarantorsSatisfied}
                className="rounded-md bg-[#1c2b22] px-5 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-40"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}