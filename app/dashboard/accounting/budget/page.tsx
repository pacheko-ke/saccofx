"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBudgetReport,
  getLineStatus,
  AVAILABLE_PERIODS,
  type BudgetLine,
  type BudgetReportData,
  type BudgetStatus,
} from "@/app/api/v1/budget";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-KE", {
  style: "percent",
  maximumFractionDigits: 1,
});

const STATUS_LABELS: Record<BudgetStatus, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  OVER_BUDGET: "Over budget",
  UNDER_UTILIZED: "Behind pace",
};

const STATUS_STYLE: Record<BudgetStatus, string> = {
  ON_TRACK: "bg-[#1c2b22] text-[#faf6ec]",
  WATCH: "bg-[#c9a24b] text-[#1c2b22]",
  OVER_BUDGET: "bg-[#7a3b2e] text-[#faf6ec]",
  UNDER_UTILIZED: "bg-[#eee7d6] text-[#1c2b22] border border-[#1c2b22]/30",
};

function utilization(line: BudgetLine) {
  return line.budgeted === 0 ? 0 : line.actual / line.budgeted;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetPage() {
  const [periodId, setPeriodId] = useState(AVAILABLE_PERIODS[0].id);
  const [data, setData] = useState<BudgetReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBudgetReport(periodId).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  const incomeLines = useMemo(
    () => data?.lines.filter((l) => l.group === "INCOME") ?? [],
    [data]
  );
  const expenseLines = useMemo(
    () => data?.lines.filter((l) => l.group === "EXPENSE") ?? [],
    [data]
  );

  const totals = useMemo(() => {
    const sum = (lines: BudgetLine[], key: "budgeted" | "actual") =>
      lines.reduce((acc, l) => acc + l[key], 0);

    const incomeBudgeted = sum(incomeLines, "budgeted");
    const incomeActual = sum(incomeLines, "actual");
    const expenseBudgeted = sum(expenseLines, "budgeted");
    const expenseActual = sum(expenseLines, "actual");

    return {
      incomeBudgeted,
      incomeActual,
      expenseBudgeted,
      expenseActual,
      netBudgeted: incomeBudgeted - expenseBudgeted,
      netActual: incomeActual - expenseActual,
    };
  }, [incomeLines, expenseLines]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[#faf6ec] text-[#1c2b22]">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm 12mm;
          }
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          .print-surface {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* ---------------------------------------------------------------- */}
        {/* Header */}
        {/* ---------------------------------------------------------------- */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#1c2b22]/15 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#1c2b22]/60">
              SaccoFX Pro &middot; Institutional Budget
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1c2b22]">
              Budget vs. Actual
            </h1>
            {data && (
              <p className="mt-1 text-sm text-[#1c2b22]/70">{data.monthLabel}</p>
            )}
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="rounded-sm border border-[#1c2b22]/25 bg-[#eee7d6] px-3 py-2 text-sm text-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#c9a24b]"
            >
              {AVAILABLE_PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              onClick={handlePrint}
              disabled={!data}
              className="rounded-sm bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-[#1c2b22]/90 disabled:opacity-50"
            >
              Print Report
            </button>
          </div>
        </header>

        {loading || !data ? (
          <div className="flex h-64 items-center justify-center text-[#1c2b22]/50">
            Loading budget…
          </div>
        ) : (
          <div className="print-surface space-y-8">
            {/* -------------------------------------------------------------- */}
            {/* Summary strip */}
            {/* -------------------------------------------------------------- */}
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryStat label="Budgeted Income" value={totals.incomeBudgeted} />
              <SummaryStat label="Actual Income" value={totals.incomeActual} />
              <SummaryStat label="Budgeted Expense" value={totals.expenseBudgeted} />
              <SummaryStat label="Actual Expense" value={totals.expenseActual} />
            </dl>

            <div
              className={`rounded-sm border px-5 py-4 ${
                totals.netActual >= 0
                  ? "border-[#c9a24b] bg-[#c9a24b]/10"
                  : "border-[#7a3b2e]/40 bg-[#7a3b2e]/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-[#1c2b22]/60">
                  Net Surplus / (Deficit) — Actual vs. Budgeted
                </span>
                <span className="font-mono text-lg font-semibold">
                  {KES.format(totals.netActual)}{" "}
                  <span className="text-sm font-normal text-[#1c2b22]/50">
                    (budgeted {KES.format(totals.netBudgeted)})
                  </span>
                </span>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Income */}
            {/* -------------------------------------------------------------- */}
            <BudgetTable
              title="Income"
              lines={incomeLines}
              monthsElapsed={data.monthsElapsed}
              monthsTotal={data.monthsTotal}
              totalBudgeted={totals.incomeBudgeted}
              totalActual={totals.incomeActual}
            />

            {/* -------------------------------------------------------------- */}
            {/* Expenses */}
            {/* -------------------------------------------------------------- */}
            <BudgetTable
              title="Expenses"
              lines={expenseLines}
              monthsElapsed={data.monthsElapsed}
              monthsTotal={data.monthsTotal}
              totalBudgeted={totals.expenseBudgeted}
              totalActual={totals.expenseActual}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-[#1c2b22]/15 bg-white/50 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-[#1c2b22]">
        {KES.format(value)}
      </dd>
    </div>
  );
}

function BudgetTable({
  title,
  lines,
  monthsElapsed,
  monthsTotal,
  totalBudgeted,
  totalActual,
}: {
  title: string;
  lines: BudgetLine[];
  monthsElapsed: number;
  monthsTotal: number;
  totalBudgeted: number;
  totalActual: number;
}) {
  const expectedPace = monthsElapsed / monthsTotal;

  return (
    <section className="rounded-sm border border-[#1c2b22]/15 bg-white/50 p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-serif text-xl font-semibold text-[#1c2b22]">{title}</h2>
        <span className="text-xs text-[#1c2b22]/50">
          Expected pace at this point in the year: {PERCENT.format(expectedPace)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[#1c2b22]/20 text-left text-xs uppercase tracking-wide text-[#1c2b22]/60">
              <th className="py-2 pr-3 font-medium">GL Code</th>
              <th className="py-2 pr-3 font-medium">Line Item</th>
              <th className="py-2 pr-3 text-right font-medium">Budgeted</th>
              <th className="py-2 pr-3 text-right font-medium">Actual</th>
              <th className="py-2 pr-3 font-medium">Utilization</th>
              <th className="py-2 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const status = getLineStatus(line, monthsElapsed, monthsTotal);
              const util = utilization(line);
              const barColor =
                status === "OVER_BUDGET"
                  ? "bg-[#7a3b2e]"
                  : status === "WATCH"
                    ? "bg-[#c9a24b]"
                    : "bg-[#1c2b22]";

              return (
                <tr
                  key={line.id}
                  className={`border-b border-[#1c2b22]/10 align-top ${
                    idx % 2 === 1 ? "bg-[#eee7d6]/40" : ""
                  }`}
                >
                  <td className="py-2.5 pr-3 font-mono text-[#1c2b22]/60">{line.glCode}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-[#1c2b22]">{line.name}</div>
                    {line.notes && (
                      <div className="text-xs italic text-[#1c2b22]/50">{line.notes}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {KES.format(line.budgeted)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">
                    {KES.format(line.actual)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#1c2b22]/10">
                        <div
                          className={`h-full ${barColor}`}
                          style={{ width: `${Math.min(util, 1) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-[#1c2b22]/60">
                        {PERCENT.format(util)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pl-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1c2b22]/20 font-semibold">
              <td colSpan={2} className="py-3 pr-3 text-right text-[#1c2b22]/70">
                Total {title}
              </td>
              <td className="py-3 pr-3 text-right font-mono">{KES.format(totalBudgeted)}</td>
              <td className="py-3 pr-3 text-right font-mono">{KES.format(totalActual)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}