"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSaccoConfig,
  updateSaccoConfig,
  type SaccoConfig,
} from "@/app/lib/sacco-config/config";

// ---------------------------------------------------------------------------
// Static option lists
// ---------------------------------------------------------------------------

const FINANCIAL_YEAR_OPTIONS = [
  { value: "JANUARY", label: "January – December" },
  { value: "APRIL", label: "April – March" },
  { value: "JULY", label: "July – June" },
  { value: "OCTOBER", label: "October – September" },
] as const;

const LOAN_INTEREST_OPTIONS = [
  { value: "REDUCING_BALANCE", label: "Reducing balance" },
  { value: "FLAT_RATE", label: "Flat rate" },
] as const;

const SASRA_CATEGORY_OPTIONS = [
  { value: "DEPOSIT_TAKING", label: "Deposit-taking (DT-SACCO)" },
  { value: "NON_DEPOSIT_TAKING", label: "Non-deposit-taking" },
] as const;

const COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Uasin Gishu",
  "Machakos", "Meru", "Kakamega", "Nyeri", "Kajiado", "Other",
];

const TIMEZONES = ["Africa/Nairobi"];

const DATE_FORMATS = ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SaccoConfigurationPage() {
  const [original, setOriginal] = useState<SaccoConfig | null>(null);
  const [draft, setDraft] = useState<SaccoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSaccoConfig().then((config) => {
      setOriginal(config);
      setDraft(config);
      setLoading(false);
    });
  }, []);

  const isDirty = useMemo(() => {
    if (!original || !draft) return false;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [original, draft]);

  function updateSection<K extends keyof SaccoConfig>(
    section: K,
    patch: Partial<SaccoConfig[K]>
  ) {
    setDraft((prev) =>
      prev ? { ...prev, [section]: { ...prev[section], ...patch } } : prev
    );
    if (saveState === "saved") setSaveState("idle");
  }

  function handleDiscard() {
    setDraft(original);
    setSaveState("idle");
  }

  async function handleSave() {
    if (!draft) return;
    setSaveState("saving");
    try {
      await updateSaccoConfig(draft);
      setOriginal(draft);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    // TODO: upload to blob storage and store the resulting URL instead of
    // an object URL, which only lives for this browser session.
    const url = URL.createObjectURL(file);
    updateSection("branding", { logoUrl: url });
  }

  if (loading || !draft) {
    return (
      <div className="min-h-screen bg-[#F6F3EC] text-[#14231E]">
        <div className="mx-auto flex h-64 max-w-4xl items-center justify-center px-6 text-[#6B7F76]">
          Loading SACCO configuration…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F3EC] pb-28 text-[#14231E]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 border-b-2 border-[#0F2F26]/10 pb-6">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8C6825]"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            SaccoFX Pro &middot; Tenant Settings
          </p>
          <h1
            className="mt-1 text-[28px] font-semibold text-[#0F2F26]"
            style={{ fontFamily: "var(--font-serif, serif)" }}
          >
            SACCO Configuration
          </h1>
          <p className="mt-1.5 text-[14px] text-[#3D4F47]">
            These settings apply to this SACCO's records only, and are visible to admins only.
          </p>
        </header>

        <div className="space-y-8">
          {/* ---------------------------------------------------------- */}
          {/* General information */}
          {/* ---------------------------------------------------------- */}
          <Section
            title="General information"
            description="How this SACCO is identified across statements, reports and regulatory filings."
          >
            <FieldGrid>
              <Field label="Legal name" span={2}>
                <TextInput
                  value={draft.general.legalName}
                  onChange={(v) => updateSection("general", { legalName: v })}
                  placeholder="Full registered co-operative name"
                />
              </Field>
              <Field label="Trading name">
                <TextInput
                  value={draft.general.tradingName}
                  onChange={(v) => updateSection("general", { tradingName: v })}
                />
              </Field>
              <Field
                label="SACCO code"
                hint="Prefixes every member number. Changing this after members are registered will not update existing member numbers."
              >
                <TextInput
                  value={draft.general.saccoCode}
                  onChange={(v) =>
                    updateSection("general", { saccoCode: v.toUpperCase() })
                  }
                  mono
                  maxLength={8}
                />
              </Field>
              <Field label="Co-operative registration no.">
                <TextInput
                  value={draft.general.registrationNumber}
                  onChange={(v) => updateSection("general", { registrationNumber: v })}
                  mono
                />
              </Field>
              <Field label="SASRA license no.">
                <TextInput
                  value={draft.general.sasraLicenseNumber}
                  onChange={(v) => updateSection("general", { sasraLicenseNumber: v })}
                  mono
                />
              </Field>
              <Field label="KRA PIN" span={2}>
                <TextInput
                  value={draft.general.kraPin}
                  onChange={(v) => updateSection("general", { kraPin: v.toUpperCase() })}
                  mono
                />
              </Field>
            </FieldGrid>
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Contact */}
          {/* ---------------------------------------------------------- */}
          <Section
            title="Contact details"
            description="Used on printed statements, receipts and member communication."
          >
            <FieldGrid>
              <Field label="Email">
                <TextInput
                  type="email"
                  value={draft.contact.email}
                  onChange={(v) => updateSection("contact", { email: v })}
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  type="tel"
                  value={draft.contact.phone}
                  onChange={(v) => updateSection("contact", { phone: v })}
                />
              </Field>
              <Field label="Physical address" span={2}>
                <TextInput
                  value={draft.contact.physicalAddress}
                  onChange={(v) => updateSection("contact", { physicalAddress: v })}
                />
              </Field>
              <Field label="County">
                <SelectInput
                  value={draft.contact.county}
                  onChange={(v) => updateSection("contact", { county: v })}
                  options={COUNTIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Postal address">
                <TextInput
                  value={draft.contact.postalAddress}
                  onChange={(v) => updateSection("contact", { postalAddress: v })}
                />
              </Field>
            </FieldGrid>
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Branding */}
          {/* ---------------------------------------------------------- */}
          <Section
            title="Member portal branding"
            description="Applies only to the member-facing portal and printed member documents — the staff console keeps its own identity."
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div>
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0F2F26]">
                  Logo
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-dashed border-[#D8CFBA] bg-[#FFFDF8]">
                    {draft.branding.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.branding.logoUrl}
                        alt="SACCO logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-[#A9B5AE]">No logo</span>
                    )}
                  </div>
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-1.5 text-[13px] font-medium text-[#0F2F26] transition-colors hover:bg-[#0F2F26]/[0.04]"
                    >
                      Upload logo
                    </button>
                    <p className="mt-1 text-[11.5px] text-[#8A9A92]">PNG, JPG or SVG</p>
                  </div>
                </div>
              </div>

              <Field label="Accent color" hint="Used for buttons and highlights in the member portal only.">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.branding.memberPortalAccentColor}
                    onChange={(e) =>
                      updateSection("branding", { memberPortalAccentColor: e.target.value })
                    }
                    className="h-9 w-9 cursor-pointer rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] p-1"
                  />
                  <TextInput
                    value={draft.branding.memberPortalAccentColor}
                    onChange={(v) => updateSection("branding", { memberPortalAccentColor: v })}
                    mono
                  />
                </div>
              </Field>
            </div>
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Financial settings */}
          {/* ---------------------------------------------------------- */}
          <Section
            title="Financial settings"
            description="Drives how the ledger, loan products and member numbering behave."
          >
            <FieldGrid>
              <Field label="Financial year">
                <SelectInput
                  value={draft.financial.financialYearStart}
                  onChange={(v) =>
                    updateSection("financial", {
                      financialYearStart: v as SaccoConfig["financial"]["financialYearStart"],
                    })
                  }
                  options={FINANCIAL_YEAR_OPTIONS as unknown as { value: string; label: string }[]}
                />
              </Field>
              <Field label="Loan interest method">
                <SelectInput
                  value={draft.financial.loanInterestMethod}
                  onChange={(v) =>
                    updateSection("financial", {
                      loanInterestMethod: v as SaccoConfig["financial"]["loanInterestMethod"],
                    })
                  }
                  options={LOAN_INTEREST_OPTIONS as unknown as { value: string; label: string }[]}
                />
              </Field>
              <Field label="Minimum share capital (KES)">
                <TextInput
                  type="number"
                  value={String(draft.financial.minimumShareCapital)}
                  onChange={(v) =>
                    updateSection("financial", { minimumShareCapital: Number(v) || 0 })
                  }
                  mono
                />
              </Field>
              <Field label="Membership registration fee (KES)">
                <TextInput
                  type="number"
                  value={String(draft.financial.membershipRegistrationFee)}
                  onChange={(v) =>
                    updateSection("financial", { membershipRegistrationFee: Number(v) || 0 })
                  }
                  mono
                />
              </Field>
              <Field
                label="Member number format"
                span={2}
                hint="{seq} is replaced with the zero-padded sequence number, e.g. SFX-{seq:04d} → SFX-0231"
              >
                <TextInput
                  value={draft.financial.memberNumberFormat}
                  onChange={(v) => updateSection("financial", { memberNumberFormat: v })}
                  mono
                />
              </Field>
            </FieldGrid>
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Regulatory */}
          {/* ---------------------------------------------------------- */}
          <Section
            title="Regulatory information"
            description="Feeds SASRA returns and the auditor's field of membership statement."
          >
            <FieldGrid>
              <Field label="SASRA category">
                <SelectInput
                  value={draft.regulatory.sasraCategory}
                  onChange={(v) =>
                    updateSection("regulatory", {
                      sasraCategory: v as SaccoConfig["regulatory"]["sasraCategory"],
                    })
                  }
                  options={SASRA_CATEGORY_OPTIONS as unknown as { value: string; label: string }[]}
                />
              </Field>
              <Field label="External auditor">
                <TextInput
                  value={draft.regulatory.externalAuditorName}
                  onChange={(v) => updateSection("regulatory", { externalAuditorName: v })}
                />
              </Field>
              <Field label="Common bond / field of membership" span={2}>
                <TextArea
                  value={draft.regulatory.commonBond}
                  onChange={(v) => updateSection("regulatory", { commonBond: v })}
                  rows={3}
                />
              </Field>
            </FieldGrid>
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Localization */}
          {/* ---------------------------------------------------------- */}
          <Section title="Localization" description="Display formats used across the platform.">
            <FieldGrid>
              <Field label="Timezone">
                <SelectInput
                  value={draft.localization.timezone}
                  onChange={(v) => updateSection("localization", { timezone: v })}
                  options={TIMEZONES.map((t) => ({ value: t, label: t }))}
                />
              </Field>
              <Field label="Date format">
                <SelectInput
                  value={draft.localization.dateFormat}
                  onChange={(v) => updateSection("localization", { dateFormat: v })}
                  options={DATE_FORMATS.map((f) => ({ value: f, label: f }))}
                />
              </Field>
            </FieldGrid>
          </Section>
        </div>
      </div>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D8CFBA] bg-[#FFFDF8]/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
            <span className="text-[13.5px] text-[#3D4F47]">
              {saveState === "error"
                ? "Couldn't save changes. Try again."
                : "You have unsaved changes."}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saveState === "saving"}
                className="rounded-[3px] px-4 py-2 text-[14px] font-medium text-[#3D4F47] transition-colors hover:bg-[#0F2F26]/[0.05] disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === "saving"}
                className="rounded-[3px] bg-[#0F2F26] px-5 py-2 text-[14px] font-medium text-[#F6F3EC] transition-colors hover:bg-[#153D32] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveState === "saving" ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved confirmation, shown briefly once clean */}
      {!isDirty && saveState === "saved" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D8CFBA] bg-[#F6F3EC]">
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-4 text-[13.5px] text-[#2F6B4F]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F6B4F]" />
            Changes saved.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout subcomponents
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[4px] border border-[#D8CFBA] bg-[#FFFDF8] p-6 sm:p-7">
      <h2
        className="text-[17px] font-semibold text-[#0F2F26]"
        style={{ fontFamily: "var(--font-serif, serif)" }}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[13.5px] leading-relaxed text-[#6B7F76]">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  span,
  children,
}: {
  label: string;
  hint?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${span === 2 ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-[#0F2F26]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-[#8A9A92]">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Form control primitives
// ---------------------------------------------------------------------------

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  mono,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] placeholder:text-[#A9B5AE] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25 ${
        mono ? "font-mono" : ""
      }`}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] leading-relaxed text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[3px] border border-[#D8CFBA] bg-[#FFFDF8] px-3 py-2 text-[14px] text-[#14231E] focus:border-[#B98A3D] focus:outline-none focus:ring-2 focus:ring-[#B98A3D]/25"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
