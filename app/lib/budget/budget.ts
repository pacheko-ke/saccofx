// lib/budget/budget.ts
// Data types and fetch helper for the Budget page (institutional
// income & expenditure budget vs. actual, not a member-facing feature).
// Lives outside app/ per project convention.

export type BudgetCategoryGroup = "INCOME" | "EXPENSE";

export type BudgetStatus = "ON_TRACK" | "WATCH" | "OVER_BUDGET" | "UNDER_UTILIZED";

export interface BudgetLine {
  id: string;
  glCode: string;
  name: string;
  group: BudgetCategoryGroup;
  budgeted: number;
  actual: number;
  notes?: string;
}

export interface BudgetPeriod {
  id: string;
  label: string; // e.g. "FY 2026"
  startDate: string;
  endDate: string;
}

export interface BudgetReportData {
  period: BudgetPeriod;
  monthLabel: string; // e.g. "Jan – Aug 2026 (8 of 12 months elapsed)"
  monthsElapsed: number;
  monthsTotal: number;
  lines: BudgetLine[];
}

export const AVAILABLE_PERIODS: BudgetPeriod[] = [
  { id: "fy2026", label: "FY 2026", startDate: "2026-01-01", endDate: "2026-12-31" },
  { id: "fy2025", label: "FY 2025", startDate: "2025-01-01", endDate: "2025-12-31" },
];

/**
 * Derives a status for a budget line based on how its utilization compares
 * to time elapsed in the period. This is a simple pacing heuristic, not an
 * accounting judgement — expense lines running hot get flagged, income
 * lines running cold get flagged.
 */
export function getLineStatus(
  line: BudgetLine,
  monthsElapsed: number,
  monthsTotal: number
): BudgetStatus {
  const expectedUtilization = monthsElapsed / monthsTotal;
  const actualUtilization = line.budgeted === 0 ? 0 : line.actual / line.budgeted;

  if (line.group === "EXPENSE") {
    if (actualUtilization > 1) return "OVER_BUDGET";
    if (actualUtilization > expectedUtilization + 0.15) return "WATCH";
    return "ON_TRACK";
  }

  // INCOME: falling behind pace is the risk, not exceeding it.
  if (actualUtilization < expectedUtilization - 0.15) return "UNDER_UTILIZED";
  return "ON_TRACK";
}

/**
 * Fetches the budget vs. actual report for a given period.
 *
 * TODO: replace with a real Server Action that:
 *   1. Verifies the JWT (sfx_session), pulls tenantId + role
 *   2. Runs `SET LOCAL app.current_tenant = $1` inside a transaction
 *      (Neon `Pool`, not `neon()`)
 *   3. Joins the `budget_lines` table against posted GL journal entries
 *      for the period to compute `actual` per GL code
 *
 * Kept as a mock generator so the page can be reviewed before the query
 * and budget-entry admin UI are built.
 */
export async function getBudgetReport(periodId: string): Promise<BudgetReportData> {
  await new Promise((r) => setTimeout(r, 350));

  const period = AVAILABLE_PERIODS.find((p) => p.id === periodId) ?? AVAILABLE_PERIODS[0];

  const lines: BudgetLine[] = [
    // Income
    {
      id: "i1",
      glCode: "4001",
      name: "Loan Interest Income",
      group: "INCOME",
      budgeted: 18000000,
      actual: 12650000,
    },
    {
      id: "i2",
      glCode: "4002",
      name: "Membership & Registration Fees",
      group: "INCOME",
      budgeted: 900000,
      actual: 640000,
    },
    {
      id: "i3",
      glCode: "4003",
      name: "Ledger & Statement Fees",
      group: "INCOME",
      budgeted: 450000,
      actual: 210000,
      notes: "Below pace — statement fee waived for digital members Q2",
    },
    {
      id: "i4",
      glCode: "4004",
      name: "M-Pesa / Bank Transfer Charges Income",
      group: "INCOME",
      budgeted: 620000,
      actual: 470000,
    },
    {
      id: "i5",
      glCode: "4005",
      name: "Investment & Dividend Income",
      group: "INCOME",
      budgeted: 1200000,
      actual: 1180000,
    },

    // Expenses
    {
      id: "e1",
      glCode: "5001",
      name: "Staff Salaries & Benefits",
      group: "EXPENSE",
      budgeted: 9600000,
      actual: 6400000,
    },
    {
      id: "e2",
      glCode: "5002",
      name: "Board & Committee Allowances",
      group: "EXPENSE",
      budgeted: 1200000,
      actual: 780000,
    },
    {
      id: "e3",
      glCode: "5003",
      name: "SMS & Communication (Africa's Talking)",
      group: "EXPENSE",
      budgeted: 480000,
      actual: 512000,
      notes: "Over budget — SMS volume up after loan reminder rollout",
    },
    {
      id: "e4",
      glCode: "5004",
      name: "Rent & Branch Utilities",
      group: "EXPENSE",
      budgeted: 2400000,
      actual: 1600000,
    },
    {
      id: "e5",
      glCode: "5005",
      name: "IT & Core Banking Platform",
      group: "EXPENSE",
      budgeted: 1800000,
      actual: 1350000,
    },
    {
      id: "e6",
      glCode: "5006",
      name: "SASRA Regulatory & Audit Fees",
      group: "EXPENSE",
      budgeted: 650000,
      actual: 650000,
    },
    {
      id: "e7",
      glCode: "5007",
      name: "Marketing & Member Outreach",
      group: "EXPENSE",
      budgeted: 700000,
      actual: 540000,
    },
    {
      id: "e8",
      glCode: "5008",
      name: "Provision for Loan Losses",
      group: "EXPENSE",
      budgeted: 2200000,
      actual: 1890000,
    },
  ];

  return {
    period,
    monthLabel: "Jan – Aug 2026 (8 of 12 months elapsed)",
    monthsElapsed: 8,
    monthsTotal: 12,
    lines,
  };
}