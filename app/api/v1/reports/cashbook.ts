// lib/reports/cashbook.ts
// Data types and fetch helper for the Cashbook Report.
// Lives outside app/ per project convention (files named route.ts inside
// app/ are treated as API routes, and shared lib code should sit alongside,
// not inside, the route tree).

export type CashbookEntryType =
  | "SAVINGS_DEPOSIT"
  | "SAVINGS_WITHDRAWAL"
  | "LOAN_DISBURSEMENT"
  | "LOAN_REPAYMENT"
  | "SHARE_PURCHASE"
  | "CHARGE_COLLECTED"
  | "OTHER";

export interface CashbookEntry {
  id: string;
  time: string; // HH:mm
  reference: string; // receipt / voucher number
  memberName: string;
  memberNumber: string;
  particulars: string;
  type: CashbookEntryType;
  cashIn: number; // 0 if not applicable
  cashOut: number; // 0 if not applicable
  tellerName: string;
}

export interface CashbookReportData {
  branchName: string;
  tillName: string;
  tellerName: string;
  reportDate: string; // ISO date
  openingBalance: number;
  entries: CashbookEntry[];
}

export const ENTRY_TYPE_LABELS: Record<CashbookEntryType, string> = {
  SAVINGS_DEPOSIT: "Savings Deposit",
  SAVINGS_WITHDRAWAL: "Savings Withdrawal",
  LOAN_DISBURSEMENT: "Loan Disbursement",
  LOAN_REPAYMENT: "Loan Repayment",
  SHARE_PURCHASE: "Share Purchase",
  CHARGE_COLLECTED: "Charge Collected",
  OTHER: "Other",
};

/**
 * Fetches cashbook data for a given date / till / teller.
 *
 * TODO: replace with a real Server Action / route handler that:
 *   1. Verifies the JWT (sfx_session) and pulls tenantId, role, memberId
 *   2. Runs `SET LOCAL app.current_tenant = $1` inside a transaction
 *      (Neon `Pool`, not `neon()` — session state is required for RLS)
 *   3. Selects transactions for the till/date from the ledger tables,
 *      ordered by created_at, and computes the running balance in SQL
 *      or in this function after fetch.
 *
 * Kept as a mock generator for now so the page can be wired up and
 * reviewed before the query is written.
 */
export async function getCashbookReport(params: {
  date: string;
  tillId: string;
}): Promise<CashbookReportData> {
  await new Promise((r) => setTimeout(r, 350)); // simulate network

  const mockEntries: CashbookEntry[] = [
    {
      id: "1",
      time: "08:14",
      reference: "RCT-20931",
      memberName: "Grace Wanjiru",
      memberNumber: "SFX-0231",
      particulars: "Regular savings deposit",
      type: "SAVINGS_DEPOSIT",
      cashIn: 5000,
      cashOut: 0,
      tellerName: "Peter Kamau",
    },
    {
      id: "2",
      time: "08:47",
      reference: "RCT-20932",
      memberName: "Joseph Mwangi",
      memberNumber: "SFX-0117",
      particulars: "Loan repayment - installment 6/24",
      type: "LOAN_REPAYMENT",
      cashIn: 12500,
      cashOut: 0,
      tellerName: "Peter Kamau",
    },
    {
      id: "3",
      time: "09:22",
      reference: "RCT-20933",
      memberName: "Alice Njeri",
      memberNumber: "SFX-0088",
      particulars: "Emergency savings withdrawal",
      type: "SAVINGS_WITHDRAWAL",
      cashIn: 0,
      cashOut: 8000,
      tellerName: "Peter Kamau",
    },
    {
      id: "4",
      time: "10:05",
      reference: "RCT-20934",
      memberName: "David Otieno",
      memberNumber: "SFX-0305",
      particulars: "Share capital top-up",
      type: "SHARE_PURCHASE",
      cashIn: 2000,
      cashOut: 0,
      tellerName: "Peter Kamau",
    },
    {
      id: "5",
      time: "11:30",
      reference: "RCT-20935",
      memberName: "Mercy Achieng",
      memberNumber: "SFX-0412",
      particulars: "Development loan disbursement",
      type: "LOAN_DISBURSEMENT",
      cashIn: 0,
      cashOut: 45000,
      tellerName: "Peter Kamau",
    },
    {
      id: "6",
      time: "13:12",
      reference: "RCT-20936",
      memberName: "Samuel Kiptoo",
      memberNumber: "SFX-0197",
      particulars: "Ledger fee",
      type: "CHARGE_COLLECTED",
      cashIn: 100,
      cashOut: 0,
      tellerName: "Peter Kamau",
    },
    {
      id: "7",
      time: "14:50",
      reference: "RCT-20937",
      memberName: "Faith Chebet",
      memberNumber: "SFX-0276",
      particulars: "Regular savings deposit",
      type: "SAVINGS_DEPOSIT",
      cashIn: 3500,
      cashOut: 0,
      tellerName: "Peter Kamau",
    },
    {
      id: "8",
      time: "15:38",
      reference: "RCT-20938",
      memberName: "Brian Mutiso",
      memberNumber: "SFX-0143",
      particulars: "Loan repayment - installment 12/12 (final)",
      type: "LOAN_REPAYMENT",
      cashIn: 9800,
      cashOut: 0,
      tellerName: "Peter Kamau",
    },
  ];

  return {
    branchName: "Nairobi CBD Branch",
    tillName: "Till 2",
    tellerName: "Peter Kamau",
    reportDate: params.date,
    openingBalance: 25000,
    entries: mockEntries,
  };
}