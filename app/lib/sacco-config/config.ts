// lib/settings/sacco-config.ts
// Data types and fetch/save helpers for the SACCO Configuration page.
// This is tenant-scoped settings (one row per SACCO), not platform-wide
// config — every read/write must go through the verified tenantId from
// the JWT, same as everywhere else in the app.

export type LoanInterestMethod = "REDUCING_BALANCE" | "FLAT_RATE";
export type SasraCategory = "DEPOSIT_TAKING" | "NON_DEPOSIT_TAKING";
export type FinancialYearStartMonth =
  | "JANUARY"
  | "APRIL"
  | "JULY"
  | "OCTOBER";

export interface SaccoGeneralInfo {
  legalName: string;
  tradingName: string;
  saccoCode: string; // short code used as the member-number prefix, e.g. "SFX"
  registrationNumber: string; // Commissioner for Co-operatives registration no.
  sasraLicenseNumber: string;
  kraPin: string;
}

export interface SaccoContactInfo {
  email: string;
  phone: string;
  physicalAddress: string;
  county: string;
  postalAddress: string;
}

export interface SaccoBranding {
  logoUrl: string | null;
  memberPortalAccentColor: string; // hex — used only in the member-facing portal, not the staff console
}

export interface SaccoFinancialSettings {
  financialYearStart: FinancialYearStartMonth;
  minimumShareCapital: number;
  membershipRegistrationFee: number;
  loanInterestMethod: LoanInterestMethod;
  memberNumberFormat: string; // e.g. "SFX-{seq:04d}"
}

export interface SaccoRegulatorySettings {
  sasraCategory: SasraCategory;
  externalAuditorName: string;
  commonBond: string; // field of membership description
}

export interface SaccoLocalization {
  timezone: string;
  dateFormat: string;
}

export interface SaccoConfig {
  tenantId: string;
  general: SaccoGeneralInfo;
  contact: SaccoContactInfo;
  branding: SaccoBranding;
  financial: SaccoFinancialSettings;
  regulatory: SaccoRegulatorySettings;
  localization: SaccoLocalization;
}

/**
 * Fetches the configuration for the current tenant.
 *
 * TODO: replace with a real Server Action that:
 *   1. Verifies the JWT (sfx_session), pulls tenantId + role
 *   2. Requires role ADMIN or SUPERADMIN — this page must never be
 *      reachable by teller/loan-officer/member roles
 *   3. Runs `SET LOCAL app.current_tenant = $1` (Neon `Pool`) and selects
 *      the single row from `sacco_config` for that tenant
 */
export async function getSaccoConfig(): Promise<SaccoConfig> {
  await new Promise((r) => setTimeout(r, 300));

  return {
    tenantId: "tenant_amani_sacco",
    general: {
      legalName: "Amani Farmers Savings & Credit Co-operative Society Ltd.",
      tradingName: "Amani SACCO",
      saccoCode: "SFX",
      registrationNumber: "CS/11482",
      sasraLicenseNumber: "SASRA/DTS/00214",
      kraPin: "P051234567X",
    },
    contact: {
      email: "info@amanisacco.co.ke",
      phone: "+254 700 112 233",
      physicalAddress: "Amani Plaza, 3rd Floor, Moi Avenue",
      county: "Nairobi",
      postalAddress: "P.O. Box 4521-00100, Nairobi",
    },
    branding: {
      logoUrl: null,
      memberPortalAccentColor: "#2F6B4F",
    },
    financial: {
      financialYearStart: "JANUARY",
      minimumShareCapital: 5000,
      membershipRegistrationFee: 500,
      loanInterestMethod: "REDUCING_BALANCE",
      memberNumberFormat: "SFX-{seq:04d}",
    },
    regulatory: {
      sasraCategory: "DEPOSIT_TAKING",
      externalAuditorName: "Nexus & Associates",
      commonBond:
        "Open to smallholder farmers and agribusiness employees within Nairobi and Kiambu counties.",
    },
    localization: {
      timezone: "Africa/Nairobi",
      dateFormat: "DD/MM/YYYY",
    },
  };
}

/**
 * Persists a full or partial config update for the current tenant.
 *
 * TODO: replace with a real Server Action — same tenant/role checks as
 * getSaccoConfig, then an UPDATE (or upsert) on `sacco_config` inside an
 * explicit BEGIN/COMMIT since this affects downstream numbering/reporting.
 * Changing `saccoCode` or `memberNumberFormat` after members already exist
 * should probably be blocked or require a migration step — flag that in
 * the UI rather than silently allowing it.
 */
export async function updateSaccoConfig(config: SaccoConfig): Promise<{ ok: true }> {
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
}