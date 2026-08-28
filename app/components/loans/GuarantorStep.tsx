"use client";

import { useState } from "react";
import OtpVerifyModal from "./OtpVerifyModal";

export interface Guarantor {
  id: string;
  fullName: string;
  phone: string;
  nationalId: string;
  relationship: string;
  guaranteedAmount: number;
  verified: boolean;
}


interface GuarantorStepProps {
  guarantors: Guarantor[];
  onChange: (guarantors: Guarantor[]) => void;
  minRequired?:number;
}

const MAX_GUARANTORS = 5;
const RELATIONSHIPS = ["Spouse", "Sibling", "Parent", "Friend", "Colleague", "Business Partner", "Other"];

const emptyDraft = {
  fullName: "",
  phone: "",
  nationalId: "",
  relationship: "",
  guaranteedAmount: "",
};

function isValidKenyanPhone(phone: string) {
  // Accepts 07XXXXXXXX, 01XXXXXXXX, or +2547XXXXXXXX / +2541XXXXXXXX
  return /^(?:\+254|0)(7|1)\d{8}$/.test(phone.trim());
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+254")) return trimmed;
  if (trimmed.startsWith("0")) return `+254${trimmed.slice(1)}`;
  return trimmed;
}

export default function GuarantorStep({ guarantors, onChange }: GuarantorStepProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [formError, setFormError] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);

  const canAddMore = guarantors.length < MAX_GUARANTORS;

  function updateDraft<K extends keyof typeof emptyDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleStartVerification() {
    setFormError("");

    if (!draft.fullName.trim()) return setFormError("Full name is required.");
    if (!isValidKenyanPhone(draft.phone)) return setFormError("Enter a valid Kenyan phone number, e.g. 0712345678.");
    if (!draft.nationalId.trim()) return setFormError("National ID is required.");
    if (!draft.relationship) return setFormError("Select the guarantor's relationship to you.");
    const amount = Number(draft.guaranteedAmount);
    if (!amount || amount <= 0) return setFormError("Enter the amount this guarantor is backing.");

    const phone = normalizePhone(draft.phone);
    if (guarantors.some((g) => g.phone === phone)) {
      return setFormError("This guarantor has already been added.");
    }

    setOtpOpen(true);
  }

  function handleVerified() {
    const newGuarantor: Guarantor = {
      id: crypto.randomUUID(),
      fullName: draft.fullName.trim(),
      phone: normalizePhone(draft.phone),
      nationalId: draft.nationalId.trim(),
      relationship: draft.relationship,
      guaranteedAmount: Number(draft.guaranteedAmount),
      verified: true,
    };
    onChange([...guarantors, newGuarantor]);
    setDraft(emptyDraft);
    setOtpOpen(false);
  }

  function removeGuarantor(id: string) {
    onChange(guarantors.filter((g) => g.id !== id));
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-xl text-[#1c2b22]">Guarantors</h2>
        <p className="mt-1 text-sm text-[#4a5c50]">
          Add between 1 and {MAX_GUARANTORS} guarantors. Each one must confirm their phone number with a one-time
          code before they're added to your application.
        </p>
      </div>

      {/* Added guarantors */}
      {guarantors.length > 0 && (
        <ul className="mb-6 space-y-3">
          {guarantors.map((g, i) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-md border border-[#c9a24b]/40 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[#1c2b22]">
                  {i + 1}. {g.fullName}{" "}
                  <span className="ml-2 inline-flex items-center rounded-full bg-[#e4efe6] px-2 py-0.5 text-xs font-medium text-[#1c2b22]">
                    ✓ Verified
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#4a5c50]">
                  {g.phone} · {g.relationship} · ID {g.nationalId} · Guaranteeing KES{" "}
                  {g.guaranteedAmount.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeGuarantor(g.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add-guarantor form */}
      {canAddMore ? (
        <div className="rounded-md border border-dashed border-[#c9a24b]/50 bg-[#faf6ec] p-5">
          <p className="mb-4 text-sm font-medium text-[#1c2b22]">
            Add guarantor {guarantors.length + 1} of {MAX_GUARANTORS}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Full name</label>
              <input
                value={draft.fullName}
                onChange={(e) => updateDraft("fullName", e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                placeholder="Jane Wanjiru"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Phone number</label>
              <input
                value={draft.phone}
                onChange={(e) => updateDraft("phone", e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                placeholder="0712345678"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">National ID</label>
              <input
                value={draft.nationalId}
                onChange={(e) => updateDraft("nationalId", e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                placeholder="12345678"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Relationship to you</label>
              <select
                value={draft.relationship}
                onChange={(e) => updateDraft("relationship", e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
              >
                <option value="">Select relationship</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Amount guaranteed (KES)</label>
              <input
                value={draft.guaranteedAmount}
                onChange={(e) => updateDraft("guaranteedAmount", e.target.value.replace(/[^\d]/g, ""))}
                className="w-full rounded-md border border-[#c9a24b]/40 px-3 py-2 text-sm focus:border-[#1c2b22] focus:outline-none"
                placeholder="50000"
                inputMode="numeric"
              />
            </div>
          </div>

          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

          <button
            type="button"
            onClick={handleStartVerification}
            className="mt-4 rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
          >
            Send OTP &amp; add guarantor
          </button>
        </div>
      ) : (
        <p className="rounded-md bg-[#e4efe6] px-4 py-3 text-sm text-[#1c2b22]">
          You've reached the maximum of {MAX_GUARANTORS} guarantors.
        </p>
      )}

      <OtpVerifyModal
        open={otpOpen}
        purpose="guarantor_verification"
        identifier={normalizePhone(draft.phone)}
        title="Verify guarantor's phone"
        description={
          <>
            We sent a 6-digit code to <span className="font-medium">{normalizePhone(draft.phone)}</span> on behalf
            of {draft.fullName || "this guarantor"}.
          </>
        }
        onClose={() => setOtpOpen(false)}
        onVerified={handleVerified}
      />
    </div>
  );
}
