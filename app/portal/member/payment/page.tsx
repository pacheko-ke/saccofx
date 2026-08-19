"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OtpVerifyModal from "@/app/components/loans/OtpVerifyModal";

const STEPS = ["Payment Details", "Method & Account", "Review", "Confirm & Process"] as const;
type Step = (typeof STEPS)[number];

type PaymentCategory = "shares" | "deposits" | "loan_repayment" | "benevolent";

interface AccountDestination {
  id: string;
  category: PaymentCategory;
  name: string;
  minAmount?: number;
}

const PAYMENT_TARGETS: AccountDestination[] = [
  { id: "share-cap", category: "shares", name: "Share Capital Top-Up" },
  { id: "norm-dep", category: "deposits", name: "Normal Savings / Deposits" },
  { id: "loan-dev", category: "loan_repayment", name: "Development Loan #LN-9042" },
  { id: "loan-emg", category: "loan_repayment", name: "Emergency Loan #LN-1102" },
  { id: "ben-fund", category: "benevolent", name: "Benevolent Fund Monthly Contribution" },
];

const PAYMENT_METHODS = [
  {
    id: "mpesa",
    name: "M-PESA Express (STK Push)",
    description: "Instant prompt on your mobile phone",
    badge: "Instant",
  },
  {
    id: "bank_transfer",
    name: "Bank Wire / EFT",
    description: "Direct bank transfer to Sacco collections account",
    badge: "1-2 Days",
  },
  {
    id: "check",
    name: "Cheque Deposit",
    description: "Upload cheque details for reconciliation",
    badge: "2-3 Days",
  },
] as const;

// Placeholder member details - align with auth session when ready
const CURRENT_MEMBER = {
  id: "member-placeholder-id",
  fullName: "Applicant Name",
  phone: "+254712345678",
  email: "applicant@example.com",
  memberNo: "SACCO-04821",
};

export default function MakePaymentPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  // Form State
  const [targetId, setTargetId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  
  const [paymentMethod, setPaymentMethod] = useState<string>("mpesa");
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState<string>(CURRENT_MEMBER.phone);
  const [bankReference, setBankReference] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState<string>("");

  // Validation & Submission State
  const [formError, setFormError] = useState<string>("");
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [transactionRef, setTransactionRef] = useState<string>("");

  const selectedTarget = PAYMENT_TARGETS.find((t) => t.id === targetId);
  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === paymentMethod);

  function goNext() {
    setFormError("");

    if (step === "Payment Details") {
      if (!targetId) return setFormError("Please select an account or loan to pay into.");
      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) return setFormError("Please enter a valid payment amount.");
      if (numAmount < 100) return setFormError("Minimum transaction amount is KES 100.");
    }

    if (step === "Method & Account") {
      if (!paymentMethod) return setFormError("Please choose a payment method.");
      if (paymentMethod === "mpesa" && !mpesaPhoneNumber.trim()) {
        return setFormError("Please enter a valid M-PESA phone number.");
      }
      if (paymentMethod === "bank_transfer" && !bankReference.trim()) {
        return setFormError("Please provide the bank transfer reference or transaction ID.");
      }
      if (paymentMethod === "check" && !chequeNumber.trim()) {
        return setFormError("Please enter the cheque number.");
      }
    }

    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleFinalPaymentSubmit() {
    setSubmitting(true);
    setSubmitError("");

    try {
      const payload = {
        memberId: CURRENT_MEMBER.id,
        targetId,
        amount: Number(amount),
        narration,
        paymentMethod,
        details: {
          mpesaPhoneNumber: paymentMethod === "mpesa" ? mpesaPhoneNumber : undefined,
          bankReference: paymentMethod === "bank_transfer" ? bankReference : undefined,
          chequeNumber: paymentMethod === "check" ? chequeNumber : undefined,
        },
        otpVerified,
      };

      const res = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to process your payment. Please try again.");
        return;
      }

      setTransactionRef(data.transactionRef || `TRX-${Math.floor(100000 + Math.random() * 900000)}`);
      setSubmitted(true);
    } catch (err) {
      setSubmitError("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-2xl text-[#1c2b22]">Make a payment</h1>
        <p className="mt-1 text-sm text-[#4a5c50]">
          saccofx pro · Top up savings, service loans, or pay share capital instantly.
        </p>

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
          {/* Step 1: Payment Details */}
          {step === "Payment Details" && (
            <div>
              <h2 className="font-serif text-xl text-[#1c2b22]">Payment details</h2>
              <p className="mt-1 text-sm text-[#4a5c50]">Select where your funds should be allocated.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4a5c50]">
                    Destination Account / Loan
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                  >
                    <option value="">Select destination target</option>
                    {PAYMENT_TARGETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4a5c50]">
                    Amount to pay (KES)
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    className="w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                    placeholder="e.g. 5000"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4a5c50]">
                    Note / Narration (Optional)
                  </label>
                  <input
                    type="text"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                    placeholder="e.g. Monthly deposit for August"
                  />
                </div>
              </div>

              {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            </div>
          )}

          {/* Step 2: Method & Account */}
          {step === "Method & Account" && (
            <div>
              <h2 className="font-serif text-xl text-[#1c2b22]">Payment method</h2>
              <p className="mt-1 text-sm text-[#4a5c50]">Choose how you wish to transfer the funds.</p>

              <div className="mt-5 space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border p-3.5 transition-colors ${
                      paymentMethod === method.id
                        ? "border-[#1c2b22] bg-[#e4efe6]"
                        : "border-[#c9a24b]/30 bg-[#faf6ec] hover:border-[#c9a24b]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="accent-[#1c2b22]"
                      />
                      <div>
                        <p className="text-sm font-medium text-[#1c2b22]">{method.name}</p>
                        <p className="text-xs text-[#4a5c50]">{method.description}</p>
                      </div>
                    </div>
                    <span className="rounded bg-[#faf6ec] px-2 py-0.5 text-[10px] font-medium text-[#1c2b22] border border-[#c9a24b]/40">
                      {method.badge}
                    </span>
                  </label>
                ))}
              </div>

              {/* Dynamic Inputs based on Method */}
              <div className="mt-5 rounded-md border border-[#c9a24b]/20 bg-[#f4eee0] p-4">
                {paymentMethod === "mpesa" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4a5c50]">
                      M-PESA Mobile Number
                    </label>
                    <input
                      type="text"
                      value={mpesaPhoneNumber}
                      onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                      className="w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                      placeholder="+254712345678"
                    />
                    <p className="mt-1 text-[11px] text-[#4a5c50]">
                      An STK prompt will be sent directly to this phone to enter your PIN.
                    </p>
                  </div>
                )}

                {paymentMethod === "bank_transfer" && (
                  <div className="space-y-3">
                    <div className="rounded bg-[#faf6ec] p-3 text-xs text-[#1c2b22] border border-[#c9a24b]/30">
                      <p className="font-semibold text-[#1c2b22]">Sacco Bank Account Details:</p>
                      <p className="mt-1">Bank: Co-operative Bank of Kenya</p>
                      <p>Account Name: SaccoFX Pro Collections</p>
                      <p>Account No: 01129000112200</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4a5c50]">
                        Bank Reference / Transaction ID
                      </label>
                      <input
                        type="text"
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        className="w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                        placeholder="e.g. REF-89301293"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "check" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4a5c50]">
                      Cheque Serial Number
                    </label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="w-full rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                      placeholder="e.g. CHQ-000412"
                    />
                  </div>
                )}
              </div>

              {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            </div>
          )}

          {/* Step 3: Review */}
          {step === "Review" && (
            <div>
              <h2 className="font-serif text-xl text-[#1c2b22]">Review payment</h2>
              <p className="mt-1 text-sm text-[#4a5c50]">
                Verify all payment information before initiating the transaction.
              </p>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Member Account</dt>
                  <dd className="font-medium text-[#1c2b22]">
                    {CURRENT_MEMBER.fullName} ({CURRENT_MEMBER.memberNo})
                  </dd>
                </div>
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Destination</dt>
                  <dd className="font-medium text-[#1c2b22]">{selectedTarget?.name}</dd>
                </div>
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Amount</dt>
                  <dd className="font-medium text-[#1c2b22]">
                    KES {Number(amount || 0).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                  <dt className="text-[#4a5c50]">Payment Method</dt>
                  <dd className="font-medium text-[#1c2b22]">{selectedMethod?.name}</dd>
                </div>

                {paymentMethod === "mpesa" && (
                  <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                    <dt className="text-[#4a5c50]">M-PESA Line</dt>
                    <dd className="font-medium text-[#1c2b22]">{mpesaPhoneNumber}</dd>
                  </div>
                )}

                {paymentMethod === "bank_transfer" && (
                  <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                    <dt className="text-[#4a5c50]">Bank Reference</dt>
                    <dd className="font-medium text-[#1c2b22]">{bankReference}</dd>
                  </div>
                )}

                {paymentMethod === "check" && (
                  <div className="flex justify-between border-b border-[#c9a24b]/20 pb-2">
                    <dt className="text-[#4a5c50]">Cheque No.</dt>
                    <dd className="font-medium text-[#1c2b22]">{chequeNumber}</dd>
                  </div>
                )}

                {narration && (
                  <div className="border-b border-[#c9a24b]/20 pb-2">
                    <dt className="text-[#4a5c50]">Narration</dt>
                    <dd className="mt-1 text-[#1c2b22]">{narration}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Step 4: Confirm & Process */}
          {step === "Confirm & Process" && (
            <div>
              {!submitted ? (
                <>
                  <h2 className="font-serif text-xl text-[#1c2b22]">Authorize payment</h2>
                  <p className="mt-1 text-sm text-[#4a5c50]">
                    Complete security verification to execute this transaction.
                  </p>

                  <div className="mt-5 rounded-md bg-[#e4efe6] px-4 py-3 text-sm text-[#1c2b22]">
                    {otpVerified ? (
                      <span>✓ Security check passed — authorized to initiate.</span>
                    ) : (
                      <span>Confirmation code will be sent to: {CURRENT_MEMBER.phone}</span>
                    )}
                  </div>

                  {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

                  {!otpVerified ? (
                    <button
                      type="button"
                      onClick={() => setOtpModalOpen(true)}
                      className="mt-5 rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
                    >
                      Send authorization code
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinalPaymentSubmit}
                      disabled={submitting}
                      className="mt-5 rounded-md bg-[#c9a24b] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#b5903f] disabled:opacity-60"
                    >
                      {submitting ? "Processing Payment..." : `Pay KES ${Number(amount).toLocaleString()}`}
                    </button>
                  )}
                </>
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e4efe6] text-2xl text-[#1c2b22]">
                    ✓
                  </div>
                  <h2 className="font-serif text-xl text-[#1c2b22]">Payment Processed</h2>
                  <p className="mt-1 text-sm text-[#4a5c50]">
                    {paymentMethod === "mpesa"
                      ? "STK prompt sent to your device. Please enter your PIN to complete transaction."
                      : "Your payment reference has been recorded and submitted for audit reconciliation."}
                  </p>
                  <div className="mt-4 inline-block rounded bg-[#f4eee0] px-3 py-1.5 text-xs font-mono text-[#1c2b22]">
                    Ref: {transactionRef}
                  </div>
                  <div className="mt-6 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard")}
                      className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {!(step === "Confirm & Process" && submitted) && (
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="rounded-md px-4 py-2 text-sm font-medium text-[#4a5c50] hover:bg-[#e2dac2] disabled:opacity-0"
            >
              Back
            </button>
            {step !== "Confirm & Process" && (
              <button
                type="button"
                onClick={goNext}
                className="rounded-md bg-[#1c2b22] px-5 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>

      <OtpVerifyModal
        open={otpModalOpen}
        purpose="payment_authorization"
        identifier={CURRENT_MEMBER.phone}
        title="Authorize Transaction"
        onClose={() => setOtpModalOpen(false)}
        onVerified={() => {
          setOtpVerified(true);
          setOtpModalOpen(false);
        }}
      />
    </div>
  );
}