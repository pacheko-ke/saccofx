"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

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

// --- Bulk import: template columns & row shape -----------------------------

const TEMPLATE_COLUMNS = [
  "Full Name",
  "National ID Number",
  "Date of Birth (YYYY-MM-DD)",
  "Gender (male/female/other)",
  "Marital Status (single/married/widowed/divorced)",
  "Phone (07XXXXXXXX)",
  "Email",
  "Physical Address",
  "County",
  "Next of Kin Name",
  "Next of Kin Relationship",
  "Next of Kin Phone",
  "Membership Type (individual/group)",
  "Monthly Contribution (KES)",
  "Number of Shares",
  "Income Source",
] as const;

const SAMPLE_ROW = [
  "Jane Wanjiru Mwangi",
  "12345678",
  "1990-05-14",
  "female",
  "married",
  "0712345678",
  "jane.mwangi@example.com",
  "Kileleshwa, Nairobi",
  "Nairobi",
  "Peter Mwangi",
  "Spouse",
  "0798765432",
  "individual",
  "2000",
  "20",
  "Employment",
];

interface BulkRow {
  rowNumber: number;
  data: Partial<FormData>;
  errors: string[];
}

function downloadMemberTemplate() {
  const worksheetData: string[][] = [[...TEMPLATE_COLUMNS], SAMPLE_ROW];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 24 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Members");
  XLSX.writeFile(workbook, "saccofx-member-import-template.xlsx");
}

const PHONE_RE = /^(?:\+254|0)\d{9}$/;

function parseWorkbookToRows(workbook: XLSX.WorkBook): BulkRow[] {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return raw.map((r, i) => {
    const get = (col: string) => String(r[col] ?? "").trim();

    const data: Partial<FormData> = {
      fullName: get("Full Name"),
      idNumber: get("National ID Number"),
      dateOfBirth: get("Date of Birth (YYYY-MM-DD)"),
      gender: get("Gender (male/female/other)").toLowerCase(),
      maritalStatus: get("Marital Status (single/married/widowed/divorced)").toLowerCase(),
      phone: get("Phone (07XXXXXXXX)"),
      email: get("Email"),
      physicalAddress: get("Physical Address"),
      county: get("County"),
      kinFullName: get("Next of Kin Name"),
      kinRelationship: get("Next of Kin Relationship"),
      kinPhone: get("Next of Kin Phone"),
      memberType: get("Membership Type (individual/group)").toLowerCase() || "individual",
      monthlyContribution: get("Monthly Contribution (KES)"),
      numberOfShares: get("Number of Shares"),
      incomeSource: get("Income Source"),
    };

    const errors: string[] = [];
    if (!data.fullName) errors.push("Full name is missing");
    if (!data.idNumber || !/^\d{6,10}$/.test(data.idNumber)) errors.push("Invalid ID number");
    if (!data.phone || !PHONE_RE.test(data.phone)) errors.push("Invalid phone number");
    if (!data.county) errors.push("County is missing");
    if (!data.monthlyContribution || Number(data.monthlyContribution) <= 0)
      errors.push("Invalid monthly contribution");
    if (!data.numberOfShares || Number(data.numberOfShares) <= 0) errors.push("Invalid number of shares");

    return { rowNumber: i + 2, data, errors }; // +2: header row + 1-indexing
  });
}

// -----------------------------------------------------------------------------

const inputClasses =
  "w-full rounded-md border border-[#c9a24b]/40 bg-white px-3.5 py-2.5 text-[15px] text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#1c2b22]/15 transition-colors";

const labelClasses = "mb-1.5 block text-[13px] font-medium text-[#4a5c50]";

type Mode = "select" | "single" | "bulk";

export default function MemberRegistrationForm() {
  const [mode, setMode] = useState<Mode>("select");

  return (
    <div className="mx-4 mt-14 overflow-hidden rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec]">
      {mode === "select" && <ModeSelect onSelect={setMode} />}
      {mode === "single" && <SingleMemberForm onBack={() => setMode("select")} />}
      {mode === "bulk" && <BulkImportForm onBack={() => setMode("select")} />}
    </div>
  );
}

// --- Mode selection screen ---------------------------------------------------

function ModeSelect({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div className="px-6 py-8 sm:px-8">
      <h1 className="font-serif text-xl text-[#1c2b22] sm:text-2xl">Add members</h1>
      <p className="mt-1 text-sm text-[#4a5c50]">
        Register a single member by hand, or import a batch of members from an Excel file.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("single")}
          className="rounded-lg border border-[#c9a24b]/40 bg-white p-5 text-left transition-colors hover:border-[#1c2b22]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4efe6] text-[#1c2b22]">
            ✎
          </div>
          <p className="mt-3 font-serif text-lg text-[#1c2b22]">Add one member</p>
          <p className="mt-1 text-sm text-[#4a5c50]">
            Step through personal details, contact info, next of kin, and shares.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelect("bulk")}
          className="rounded-lg border border-[#c9a24b]/40 bg-white p-5 text-left transition-colors hover:border-[#1c2b22]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3e6c8] text-[#7a5c1e]">
            ⇪
          </div>
          <p className="mt-3 font-serif text-lg text-[#1c2b22]">Import from Excel</p>
          <p className="mt-1 text-sm text-[#4a5c50]">
            Download the template, fill it in, and upload it to register many members at once.
          </p>
        </button>
      </div>
    </div>
  );
}

// --- Bulk import screen -------------------------------------------------------

function BulkImportForm({ onBack }: { onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState<{ imported: number; failed: number } | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setSubmitResult(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsed = parseWorkbookToRows(workbook);

      if (parsed.length === 0) {
        setParseError("No rows found in this file. Make sure you filled in the template below the header row.");
        setRows([]);
        return;
      }
      setRows(parsed);
    } catch (err) {
      setParseError("Couldn't read this file. Please make sure it's a valid .xlsx file exported from the template.");
      setRows([]);
    }
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Replace with your actual bulk-import API route.
      const res = await fetch("/api/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: validRows.map((r) => r.data) }),
      });
      if (!res.ok) throw new Error("Failed to import members");
      const result = await res.json();
      setSubmitResult({
        imported: result.imported ?? validRows.length,
        failed: result.failed ?? 0,
      });
      setRows([]);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="border-b border-[#c9a24b]/30 px-6 py-5 sm:px-8">
        <button type="button" onClick={onBack} className="mb-2 text-xs font-medium text-[#4a5c50] hover:underline">
          ← Back
        </button>
        <h1 className="font-serif text-xl text-[#1c2b22] sm:text-2xl">Import members from Excel</h1>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {submitResult ? (
          <div className="rounded-md border border-[#c9a24b]/30 bg-[#e4efe6] p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1c2b22] text-[#faf6ec]">
              ✓
            </div>
            <h2 className="font-serif text-lg text-[#1c2b22]">Import complete</h2>
            <p className="mt-1 text-sm text-[#4a5c50]">
              {submitResult.imported} member{submitResult.imported !== 1 ? "s" : ""} imported
              {submitResult.failed > 0 ? `, ${submitResult.failed} failed` : ""}.
            </p>
            <button
              type="button"
              onClick={() => setSubmitResult(null)}
              className="mt-4 rounded-md border border-[#c9a24b]/40 px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-white"
            >
              Import another file
            </button>
          </div>
        ) : (
          <>
            {/* Step 1: template */}
            <div className="rounded-md border border-[#c9a24b]/30 bg-white p-5">
              <p className="text-sm font-medium text-[#1c2b22]">1. Download the template</p>
              <p className="mt-1 text-sm text-[#4a5c50]">
                Use this file to format member data correctly. Keep the header row unchanged and add one member
                per row below it.
              </p>
              <button
                type="button"
                onClick={downloadMemberTemplate}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#c9a24b] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#f3e6c8]"
              >
                ⬇ Download Excel template
              </button>
            </div>

            {/* Step 2: upload */}
            <div className="mt-4 rounded-md border border-[#c9a24b]/30 bg-white p-5">
              <p className="text-sm font-medium text-[#1c2b22]">2. Upload your completed file</p>
              <p className="mt-1 text-sm text-[#4a5c50]">Accepts .xlsx and .xls files.</p>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
                >
                  Choose file
                </button>
                {fileName && <span className="text-sm text-[#4a5c50]">{fileName}</span>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {parseError && <p className="mt-3 text-sm text-red-600">{parseError}</p>}
            </div>

            {/* Step 3: preview */}
            {rows.length > 0 && (
              <div className="mt-4 rounded-md border border-[#c9a24b]/30 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#1c2b22]">3. Review before importing</p>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full bg-[#e4efe6] px-2.5 py-0.5 font-medium text-[#1c2b22]">
                      {validRows.length} ready
                    </span>
                    {invalidRows.length > 0 && (
                      <span className="rounded-full bg-[#f4dede] px-2.5 py-0.5 font-medium text-[#8a2c2c]">
                        {invalidRows.length} need fixing
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-[#c9a24b]/20">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-[#eee7d6] text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium text-[#1c2b22]">Row</th>
                        <th className="px-3 py-2 font-medium text-[#1c2b22]">Name</th>
                        <th className="px-3 py-2 font-medium text-[#1c2b22]">ID</th>
                        <th className="px-3 py-2 font-medium text-[#1c2b22]">Phone</th>
                        <th className="px-3 py-2 font-medium text-[#1c2b22]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c9a24b]/15">
                      {rows.map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="px-3 py-2 text-[#4a5c50]">{r.rowNumber}</td>
                          <td className="px-3 py-2 text-[#1c2b22]">{r.data.fullName || "—"}</td>
                          <td className="px-3 py-2 text-[#4a5c50]">{r.data.idNumber || "—"}</td>
                          <td className="px-3 py-2 text-[#4a5c50]">{r.data.phone || "—"}</td>
                          <td className="px-3 py-2">
                            {r.errors.length === 0 ? (
                              <span className="text-xs font-medium text-[#1c2b22]">✓ Ready</span>
                            ) : (
                              <span className="text-xs font-medium text-[#8a2c2c]" title={r.errors.join("; ")}>
                                {r.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validRows.length === 0 || submitting}
                  className="mt-4 rounded-md bg-[#1c2b22] px-5 py-2.5 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-50"
                >
                  {submitting ? "Importing…" : `Import ${validRows.length} member${validRows.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Single member step form (ledger-styled) ---------------------------------

function SingleMemberForm({ onBack }: { onBack: () => void }) {
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

  function goBackStep() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to submit application");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1c2b22] text-[#faf6ec]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-[#1c2b22]">Application received</h2>
        <p className="mt-2 text-[15px] text-[#4a5c50]">
          {formData.fullName.split(" ")[0] || "Your"} application to join has been recorded. A membership officer
          will verify the details and confirm share allocation.
        </p>
        <button
          onClick={() => {
            setFormData(initialFormData);
            setStep(0);
            setSubmitted(false);
          }}
          className="mt-6 rounded-md border border-[#c9a24b]/40 px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
        >
          Register another member
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="border-b border-[#c9a24b]/30 px-6 py-5 sm:px-8">
        <button type="button" onClick={onBack} className="mb-2 text-xs font-medium text-[#4a5c50] hover:underline">
          ← Back
        </button>
        <h1 className="font-serif text-xl text-[#1c2b22] sm:text-2xl">Add member</h1>
      </div>

      {/* Ledger-style progress rail */}
      <div className="flex border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 px-2 sm:px-4">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "upcoming";
          return (
            <div
              key={s.label}
              className={`flex flex-1 flex-col items-center gap-1.5 border-t-2 px-1 py-3 text-center ${
                state === "active" ? "border-[#c9a24b]" : state === "done" ? "border-[#c9a24b]/40" : "border-transparent"
              }`}
            >
              <span className={`text-[11px] tabular-nums ${state === "upcoming" ? "text-[#9aa79f]" : "text-[#7a5c1e]"}`}>
                {s.ledger}
              </span>
              <span
                className={`hidden text-[11px] font-medium leading-tight sm:block ${
                  state === "upcoming" ? "text-[#9aa79f]" : "text-[#1c2b22]"
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
        <p className="mb-6 text-lg text-[#1c2b22] sm:hidden">{STEPS[step].label}</p>

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
                {errors.dateOfBirth && <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Gender</label>
                <select className={inputClasses} value={formData.gender} onChange={(e) => update("gender", e.target.value)}>
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
              {errors.physicalAddress && <p className="mt-1 text-xs text-red-600">{errors.physicalAddress}</p>}
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
            <p className="text-sm text-[#4a5c50]">
              Your next of kin will be the designated beneficiary on your account.
            </p>
            <div>
              <label className={labelClasses}>Full name</label>
              <input
                className={inputClasses}
                value={formData.kinFullName}
                onChange={(e) => update("kinFullName", e.target.value)}
              />
              {errors.kinFullName && <p className="mt-1 text-xs text-red-600">{errors.kinFullName}</p>}
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
                {errors.kinRelationship && <p className="mt-1 text-xs text-red-600">{errors.kinRelationship}</p>}
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
                        ? "border-[#1c2b22] bg-[#e4efe6] text-[#1c2b22]"
                        : "border-[#c9a24b]/40 text-[#4a5c50] hover:bg-[#eee7d6]"
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
                {errors.numberOfShares && <p className="mt-1 text-xs text-red-600">{errors.numberOfShares}</p>}
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
              {errors.incomeSource && <p className="mt-1 text-xs text-red-600">{errors.incomeSource}</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="divide-y divide-[#c9a24b]/20 overflow-hidden rounded-md border border-[#c9a24b]/30">
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

            <label className="flex items-start gap-2.5 text-sm text-[#4a5c50]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-[#c9a24b]/50 text-[#1c2b22] focus:ring-[#1c2b22]/30"
                checked={formData.termsAccepted}
                onChange={(e) => update("termsAccepted", e.target.checked)}
              />
              <span>
                I confirm the information provided is accurate and I agree to the Sacco's membership terms and
                bylaws.
              </span>
            </label>
            {errors.termsAccepted && <p className="text-xs text-red-600">{errors.termsAccepted}</p>}

            {submitError && (
              <p className="rounded-md bg-[#f4dede] px-3 py-2 text-sm text-[#8a2c2c]">{submitError}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-[#c9a24b]/30 px-6 py-4 sm:px-8">
        <button
          type="button"
          onClick={goBackStep}
          disabled={step === 0}
          className="rounded-md px-4 py-2 text-sm font-medium text-[#4a5c50] hover:bg-[#eee7d6] disabled:opacity-0"
        >
          Back
        </button>
        {!isLastStep ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-[#1c2b22] px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition-colors hover:bg-[#233a2c]"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-[#c9a24b] px-5 py-2.5 text-sm font-medium text-[#1c2b22] transition-colors hover:bg-[#b5903f] disabled:opacity-60"
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5c50]">{title}</p>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-[#1c2b22] hover:underline">
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[#4a5c50]">{label}</dt>
            <dd className="text-[#1c2b22]">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}