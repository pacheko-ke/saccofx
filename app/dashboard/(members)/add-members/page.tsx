"use client";

import { useState } from "react";

/**
 * Multi-step SACCO member registration form.
 *
 * Drop into a Next.js App Router project (e.g. app/members/new/page.tsx or
 * components/MemberRegistrationForm.tsx). Uses Tailwind CSS classes only —
 * no extra UI dependencies required.
 *
 * Wire up handleSubmit() to POST to your API route, e.g.:
 *   const res = await fetch("/api/members", { method: "POST", body: JSON.stringify(formData) })
 * which your Prisma route handler can then use to create a Member record.
 */

type FormData = {
  // Step 1: Personal details
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;

  // Step 2: Contact & address
  phone: string;
  email: string;
  physicalAddress: string;
  county: string;

  // Step 3: Next of kin
  kinFullName: string;
  kinRelationship: string;
  kinPhone: string;

  // Step 4: Membership & shares
  memberType: string;
  monthlyContribution: string;
  numberOfShares: string;
  incomeSource: string;

  // Step 5: Confirmation
  termsAccepted: boolean;
};

const initialFormData: FormData = {
  fullName: "",
  idNumber: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  phone: "",
  email: "",
  physicalAddress: "",
  county: "",
  kinFullName: "",
  kinRelationship: "",
  kinPhone: "",
  memberType: "individual",
  monthlyContribution: "",
  numberOfShares: "",
  incomeSource: "",
  termsAccepted: false,
};

const STEPS = [
  { label: "Personal Details", ledger: "01" },
  { label: "Contact & Address", ledger: "02" },
  { label: "Next of Kin", ledger: "03" },
  { label: "Membership & Shares", ledger: "04" },
  { label: "Review & Submit", ledger: "05" },
];

const inputClasses =
  "w-full rounded-md border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 transition-colors";

const labelClasses = "mb-1.5 block text-[13px] font-medium text-stone-700";

export default function MemberRegistrationForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isLastStep = step === STEPS.length - 1;

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep(current: number): boolean {
    const next: Partial<Record<keyof FormData, string>> = {};

    if (current === 0) {
      if (!formData.fullName.trim()) next.fullName = "Full name is required";
      if (!formData.idNumber.trim()) next.idNumber = "National ID number is required";
      else if (!/^\d{6,10}$/.test(formData.idNumber.trim()))
        next.idNumber = "Enter a valid ID number";
      if (!formData.dateOfBirth) next.dateOfBirth = "Date of birth is required";
      if (!formData.gender) next.gender = "Select a gender";
    }

    if (current === 1) {
      if (!formData.phone.trim()) next.phone = "Phone number is required";
      else if (!/^(?:\+254|0)\d{9}$/.test(formData.phone.trim()))
        next.phone = "Use format 07XXXXXXXX or +254XXXXXXXXX";
      if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email))
        next.email = "Enter a valid email address";
      if (!formData.physicalAddress.trim()) next.physicalAddress = "Address is required";
      if (!formData.county.trim()) next.county = "County is required";
    }

    if (current === 2) {
      if (!formData.kinFullName.trim()) next.kinFullName = "Next of kin name is required";
      if (!formData.kinRelationship.trim()) next.kinRelationship = "Relationship is required";
      if (!formData.kinPhone.trim()) next.kinPhone = "Next of kin phone is required";
      else if (!/^(?:\+254|0)\d{9}$/.test(formData.kinPhone.trim()))
        next.kinPhone = "Use format 07XXXXXXXX or +254XXXXXXXXX";
    }

    if (current === 3) {
      if (!formData.monthlyContribution || Number(formData.monthlyContribution) <= 0)
        next.monthlyContribution = "Enter a monthly contribution amount";
      if (!formData.numberOfShares || Number(formData.numberOfShares) <= 0)
        next.numberOfShares = "Enter number of shares to purchase";
      if (!formData.incomeSource.trim()) next.incomeSource = "Source of income is required";
    }

    if (current === 4) {
      if (!formData.termsAccepted) next.termsAccepted = "You must accept the membership terms";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Replace with your actual API route.
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to submit application");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-stone-200 bg-white p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-800 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-stone-900">Application received</h2>
        <p className="mt-2 text-[15px] text-stone-600">
          {formData.fullName.split(" ")[0] || "Your"} application to join has been recorded.
          A membership officer will verify your details and confirm your share allocation.
        </p>
        <button
          onClick={() => {
            setFormData(initialFormData);
            setStep(0);
            setSubmitted(false);
          }}
          className="mt-6 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Register another member
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto overflow-hidden rounded-lg border border-stone-200 bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 bg-emerald-900 px-6 py-5 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
          Membership Application
        </p>
        <h1 className="mt-1 font-serif text-xl text-white sm:text-2xl">Join the Sacco</h1>
      </div>

      {/* Ledger-style progress rail */}
      <div className="flex border-b border-stone-200 bg-stone-50 px-2 sm:px-4">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "upcoming";
          return (
            <div
              key={s.label}
              className={`flex flex-1 flex-col items-center gap-1.5 border-t-2 px-1 py-3 text-center ${
                state === "active"
                  ? "border-emerald-800"
                  : state === "done"
                  ? "border-emerald-800/40"
                  : "border-transparent"
              }`}
            >
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  state === "upcoming" ? "text-stone-400" : "text-emerald-800"
                }`}
              >
                {s.ledger}
              </span>
              <span
                className={`hidden text-[11px] font-medium leading-tight sm:block ${
                  state === "upcoming" ? "text-stone-400" : "text-stone-800"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="px-6 py-7 sm:px-8">
        <p className="mb-6 font-serif text-lg text-stone-900 sm:hidden">{STEPS[step].label}</p>

        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className={labelClasses}>Full name</label>
              <input
                className={inputClasses}
                value={formData.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="As it appears on your national ID"
              />
              {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>National ID number</label>
                <input
                  className={inputClasses}
                  value={formData.idNumber}
                  onChange={(e) => update("idNumber", e.target.value)}
                  placeholder="e.g. 12345678"
                  inputMode="numeric"
                />
                {errors.idNumber && <p className="mt-1 text-xs text-red-600">{errors.idNumber}</p>}
              </div>
              <div>
                <label className={labelClasses}>Date of birth</label>
                <input
                  type="date"
                  className={inputClasses}
                  value={formData.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                />
                {errors.dateOfBirth && (
                  <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Gender</label>
                <select
                  className={inputClasses}
                  value={formData.gender}
                  onChange={(e) => update("gender", e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Prefer not to say</option>
                </select>
                {errors.gender && <p className="mt-1 text-xs text-red-600">{errors.gender}</p>}
              </div>
              <div>
                <label className={labelClasses}>Marital status</label>
                <select
                  className={inputClasses}
                  value={formData.maritalStatus}
                  onChange={(e) => update("maritalStatus", e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="widowed">Widowed</option>
                  <option value="divorced">Divorced</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Phone number</label>
                <input
                  className={inputClasses}
                  value={formData.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="07XX XXX XXX"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div>
                <label className={labelClasses}>Email (optional)</label>
                <input
                  className={inputClasses}
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label className={labelClasses}>Physical address</label>
              <input
                className={inputClasses}
                value={formData.physicalAddress}
                onChange={(e) => update("physicalAddress", e.target.value)}
                placeholder="Estate, street, house number"
              />
              {errors.physicalAddress && (
                <p className="mt-1 text-xs text-red-600">{errors.physicalAddress}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>County</label>
              <input
                className={inputClasses}
                value={formData.county}
                onChange={(e) => update("county", e.target.value)}
                placeholder="e.g. Nairobi"
              />
              {errors.county && <p className="mt-1 text-xs text-red-600">{errors.county}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-stone-500">
              Your next of kin will be the designated beneficiary on your account.
            </p>
            <div>
              <label className={labelClasses}>Full name</label>
              <input
                className={inputClasses}
                value={formData.kinFullName}
                onChange={(e) => update("kinFullName", e.target.value)}
              />
              {errors.kinFullName && (
                <p className="mt-1 text-xs text-red-600">{errors.kinFullName}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Relationship</label>
                <input
                  className={inputClasses}
                  value={formData.kinRelationship}
                  onChange={(e) => update("kinRelationship", e.target.value)}
                  placeholder="e.g. Spouse, Sibling"
                />
                {errors.kinRelationship && (
                  <p className="mt-1 text-xs text-red-600">{errors.kinRelationship}</p>
                )}
              </div>
              <div>
                <label className={labelClasses}>Phone number</label>
                <input
                  className={inputClasses}
                  value={formData.kinPhone}
                  onChange={(e) => update("kinPhone", e.target.value)}
                  placeholder="07XX XXX XXX"
                />
                {errors.kinPhone && <p className="mt-1 text-xs text-red-600">{errors.kinPhone}</p>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className={labelClasses}>Membership type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "individual", label: "Individual" },
                  { value: "group", label: "Group / Chama" },
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => update("memberType", opt.value)}
                    className={`rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      formData.memberType === opt.value
                        ? "border-emerald-800 bg-emerald-50 text-emerald-900"
                        : "border-stone-300 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Monthly contribution (KES)</label>
                <input
                  className={inputClasses}
                  value={formData.monthlyContribution}
                  onChange={(e) => update("monthlyContribution", e.target.value)}
                  placeholder="e.g. 2000"
                  inputMode="numeric"
                />
                {errors.monthlyContribution && (
                  <p className="mt-1 text-xs text-red-600">{errors.monthlyContribution}</p>
                )}
              </div>
              <div>
                <label className={labelClasses}>Number of shares</label>
                <input
                  className={inputClasses}
                  value={formData.numberOfShares}
                  onChange={(e) => update("numberOfShares", e.target.value)}
                  placeholder="e.g. 20"
                  inputMode="numeric"
                />
                {errors.numberOfShares && (
                  <p className="mt-1 text-xs text-red-600">{errors.numberOfShares}</p>
                )}
              </div>
            </div>

            <div>
              <label className={labelClasses}>Main source of income</label>
              <input
                className={inputClasses}
                value={formData.incomeSource}
                onChange={(e) => update("incomeSource", e.target.value)}
                placeholder="e.g. Employment, business, farming"
              />
              {errors.incomeSource && (
                <p className="mt-1 text-xs text-red-600">{errors.incomeSource}</p>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="rounded-md border border-stone-200 divide-y divide-stone-200 overflow-hidden">
              <ReviewSection
                title="Personal details"
                rows={[
                  ["Full name", formData.fullName],
                  ["ID number", formData.idNumber],
                  ["Date of birth", formData.dateOfBirth],
                  ["Gender", formData.gender],
                ]}
                onEdit={() => setStep(0)}
              />
              <ReviewSection
                title="Contact & address"
                rows={[
                  ["Phone", formData.phone],
                  ["Email", formData.email || "—"],
                  ["Address", formData.physicalAddress],
                  ["County", formData.county],
                ]}
                onEdit={() => setStep(1)}
              />
              <ReviewSection
                title="Next of kin"
                rows={[
                  ["Name", formData.kinFullName],
                  ["Relationship", formData.kinRelationship],
                  ["Phone", formData.kinPhone],
                ]}
                onEdit={() => setStep(2)}
              />
              <ReviewSection
                title="Membership & shares"
                rows={[
                  ["Type", formData.memberType],
                  ["Monthly contribution", `KES ${formData.monthlyContribution || "0"}`],
                  ["Shares", formData.numberOfShares],
                  ["Income source", formData.incomeSource],
                ]}
                onEdit={() => setStep(3)}
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm text-stone-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-800/30"
                checked={formData.termsAccepted}
                onChange={(e) => update("termsAccepted", e.target.checked)}
              />
              <span>
                I confirm the information provided is accurate and I agree to the Sacco's
                membership terms and bylaws.
              </span>
            </label>
            {errors.termsAccepted && (
              <p className="text-xs text-red-600">{errors.termsAccepted}</p>
            )}

            {submitError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4 sm:px-8">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-0"
        >
          Back
        </button>
        {!isLastStep ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-900 transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: [string, string][];
  onEdit: () => void;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-emerald-800 hover:underline"
        >
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-stone-500">{label}</dt>
            <dd className="text-stone-900">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}