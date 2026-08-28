"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCashbookReport,
  ENTRY_TYPE_LABELS,
  type CashbookEntry,
  type CashbookEntryType,
  type CashbookReportData,
} from "@/app/api/v1/reports/cashbook";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// A running balance row, derived from raw entries.
interface LedgerRow extends CashbookEntry {
  runningBalance: number;
}

function withRunningBalance(
  entries: CashbookEntry[],
  openingBalance: number
): LedgerRow[] {
  let balance = openingBalance;
  return entries.map((entry) => {
    balance = balance + entry.cashIn - entry.cashOut;
    return { ...entry, runningBalance: balance };
  });
}

// Badge color per entry type — kept within the brass/ink/cream family so
// nothing competes with the passbook palette.
const TYPE_BADGE_STYLE: Record<CashbookEntryType, string> = {
  SAVINGS_DEPOSIT: "bg-[#1c2b22] text-[#faf6ec]",
  SAVINGS_WITHDRAWAL: "bg-[#eee7d6] text-[#1c2b22] border border-[#1c2b22]/30",
  LOAN_DISBURSEMENT: "bg-[#eee7d6] text-[#1c2b22] border border-[#1c2b22]/30",
  LOAN_REPAYMENT: "bg-[#1c2b22] text-[#faf6ec]",
  SHARE_PURCHASE: "bg-[#c9a24b] text-[#1c2b22]",
  CHARGE_COLLECTED: "bg-[#c9a24b] text-[#1c2b22]",
  OTHER: "bg-[#eee7d6] text-[#1c2b22] border border-[#1c2b22]/30",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TILLS = [
  { id: "till-1", label: "Till 1" },
  { id: "till-2", label: "Till 2" },
  { id: "till-3", label: "Till 3 (Mobile)" },
];

export default function CashbookReportPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tillId, setTillId] = useState(TILLS[1].id);
  const [typeFilter, setTypeFilter] = useState<"ALL" | CashbookEntryType>("ALL");
  const [data, setData] = useState<CashbookReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCashbookReport({ date, tillId }).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, tillId]);

  const ledgerRows = useMemo(() => {
    if (!data) return [];
    return withRunningBalance(data.entries, data.openingBalance);
  }, [data]);

  const filteredRows = useMemo(() => {
    if (typeFilter === "ALL") return ledgerRows;
    return ledgerRows.filter((row) => row.type === typeFilter);
  }, [ledgerRows, typeFilter]);

  const totals = useMemo(() => {
    const cashIn = ledgerRows.reduce((sum, r) => sum + r.cashIn, 0);
    const cashOut = ledgerRows.reduce((sum, r) => sum + r.cashOut, 0);
    return {
      cashIn,
      cashOut,
      closingBalance: (data?.openingBalance ?? 0) + cashIn - cashOut,
    };
  }, [ledgerRows, data]);

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    if (!data) return;
    const header = [
      "Time",
      "Reference",
      "Member",
      "Member No.",
      "Particulars",
      "Type",
      "Cash In",
      "Cash Out",
      "Running Balance",
    ];
    const rows = filteredRows.map((r) => [
      r.time,
      r.reference,
      r.memberName,
      r.memberNumber,
      r.particulars,
      ENTRY_TYPE_LABELS[r.type],
      r.cashIn.toFixed(2),
      r.cashOut.toFixed(2),
      r.runningBalance.toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cashbook-${date}-${tillId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#faf6ec] text-[#1c2b22]">
      {/* Print styles: A4, hide interactive chrome */}
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
              SaccoFX Pro &middot; Daily Ledger
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1c2b22]">
              Cashbook Report
            </h1>
            {data && (
              <p className="mt-1 text-sm text-[#1c2b22]/70">
                {data.branchName} &middot; {data.tillName} &middot; Teller: {data.tellerName}
              </p>
            )}
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={!data}
              className="rounded-sm border border-[#1c2b22]/30 bg-[#eee7d6] px-4 py-2 text-sm font-medium text-[#1c2b22] transition hover:bg-[#1c2b22]/10 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={!data}
              className="rounded-sm bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-[#1c2b22]/90 disabled:opacity-50"
            >
              Print Report
            </button>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Filters */}
        {/* ---------------------------------------------------------------- */}
        <div className="no-print mb-8 flex flex-wrap items-end gap-4 rounded-sm border border-[#1c2b22]/15 bg-white/40 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
              Report Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-sm border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#c9a24b]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
              Till
            </label>
            <select
              value={tillId}
              onChange={(e) => setTillId(e.target.value)}
              className="rounded-sm border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#c9a24b]"
            >
              {TILLS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
              Transaction Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="rounded-sm border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#c9a24b]"
            >
              <option value="ALL">All types</option>
              {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {data && (
            <p className="ml-auto self-end pb-2 text-sm text-[#1c2b22]/60">
              {formatDateLong(data.reportDate)}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Body */}
        {/* ---------------------------------------------------------------- */}
        {loading || !data ? (
          <div className="flex h-64 items-center justify-center text-[#1c2b22]/50">
            Loading cashbook…
          </div>
        ) : (
          <div className="print-surface rounded-sm border border-[#1c2b22]/15 bg-white/50 p-6 shadow-sm">
            {/* Summary strip */}
            <dl className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryStat label="Opening Balance" value={data.openingBalance} />
              <SummaryStat label="Total Cash In" value={totals.cashIn} tone="positive" />
              <SummaryStat label="Total Cash Out" value={totals.cashOut} tone="negative" />
              <SummaryStat
                label="Closing Balance"
                value={totals.closingBalance}
                emphasize
              />
            </dl>

            {/* Ledger table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-[#1c2b22]/20 text-left text-xs uppercase tracking-wide text-[#1c2b22]/60">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Ref.</th>
                    <th className="py-2 pr-3 font-medium">Particulars</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 text-right font-medium">Cash In</th>
                    <th className="py-2 pr-3 text-right font-medium">Cash Out</th>
                    <th className="py-2 pl-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {filteredRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-[#1c2b22]/10 ${
                        idx % 2 === 1 ? "bg-[#eee7d6]/40" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-3 align-top text-[#1c2b22]/70">{row.time}</td>
                      <td className="py-2.5 pr-3 align-top text-[#1c2b22]/70">
                        {row.reference}
                      </td>
                      <td className="py-2.5 pr-3 align-top font-sans">
                        <div className="text-[#1c2b22]">{row.particulars}</div>
                        <div className="text-xs text-[#1c2b22]/50">
                          {row.memberName} &middot; {row.memberNumber}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-sans font-medium ${TYPE_BADGE_STYLE[row.type]}`}
                        >
                          {ENTRY_TYPE_LABELS[row.type]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right align-top">
                        {row.cashIn > 0 ? KES.format(row.cashIn) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right align-top">
                        {row.cashOut > 0 ? KES.format(row.cashOut) : "—"}
                      </td>
                      <td className="py-2.5 pl-3 text-right align-top font-semibold">
                        {KES.format(row.runningBalance)}
                      </td>
                    </tr>
                  ))}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center font-sans text-[#1c2b22]/50">
                        No transactions match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#1c2b22]/20 font-mono font-semibold">
                    <td colSpan={4} className="py-3 pr-3 text-right font-sans text-[#1c2b22]/70">
                      Totals
                    </td>
                    <td className="py-3 pr-3 text-right">{KES.format(totals.cashIn)}</td>
                    <td className="py-3 pr-3 text-right">{KES.format(totals.cashOut)}</td>
                    <td className="py-3 pl-3 text-right text-[#c9a24b]">
                      {KES.format(totals.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Sign-off strip — mirrors the physical cashbook sign-off convention */}
            <div className="mt-10 grid grid-cols-2 gap-8 border-t border-dashed border-[#1c2b22]/25 pt-6 text-sm">
              <div>
                <p className="text-[#1c2b22]/60">Prepared by (Teller)</p>
                <p className="mt-6 border-t border-[#1c2b22]/30 pt-1 font-serif">
                  {data.tellerName}
                </p>
              </div>
              <div>
                <p className="text-[#1c2b22]/60">Verified by (Supervisor)</p>
                <p className="mt-6 border-t border-[#1c2b22]/30 pt-1">&nbsp;</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SummaryStat({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string;
  value: number;
  tone?: "positive" | "negative";
  emphasize?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-[#1c2b22]"
      : tone === "negative"
        ? "text-[#7a3b2e]"
        : "text-[#1c2b22]";

  return (
    <div
      className={`rounded-sm border px-4 py-3 ${
        emphasize
          ? "border-[#c9a24b] bg-[#c9a24b]/10"
          : "border-[#1c2b22]/15 bg-[#faf6ec]"
      }`}
    >
      <dt className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{label}</dt>
      <dd className={`mt-1 font-mono text-lg font-semibold ${toneClass}`}>
        {KES.format(value)}
      </dd>
    </div>
  );
}