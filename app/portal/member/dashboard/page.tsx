"use client";

import { useEffect, useState } from "react";
import {
  PiggyBank,
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Download,
  CreditCard,
  Send,
  FileText,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

interface MemberSummary {
  memberId: string;
  memberNumber: string;
  fullName: string;
  memberSince: string; // ISO date
  savingsBalance: number;
  shareCapital: number;
  activeLoanBalance: number;
  nextLoanRepayment: {
    amount: number;
    dueDate: string; // ISO date
  } | null;
  savingsChangePct: number;
}

interface SavingsPoint {
  month: string;
  balance: number;
}

interface TransactionRow {
  id: string;
  date: string; // ISO
  description: string;
  type: "deposit" | "withdrawal" | "loan_repayment" | "share_purchase" | "charge";
  amount: number; // positive = credit, negative = debit
  balanceAfter: number;
}

interface LoanSummary {
  loanId: string;
  productName: string;
  outstandingBalance: number;
  nextDueDate: string | null;
  status: "active" | "cleared" | "overdue";
}

interface MemberDashboardResponse {
  summary: MemberSummary;
  savingsTrend: SavingsPoint[];
  recentTransactions: TransactionRow[];
  loans: LoanSummary[];
}

const TRANSACTION_LABEL: Record<TransactionRow["type"], string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  loan_repayment: "Loan Repayment",
  share_purchase: "Share Purchase",
  charge: "Charge",
};

const LOAN_STATUS_STYLE: Record<LoanSummary["status"], string> = {
  active: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
  cleared: "bg-[#eee7d6] text-[#1c2b22]/60 border-[#1c2b22]/15",
  overdue: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
};

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function MemberDashboard() {
  const [data, setData] = useState<MemberDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/v1/members/main");

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Dashboard API returned ${res.status}`);
        }

        const json = (await res.json()) as MemberDashboardResponse;

        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load your dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#faf6ec] font-sans text-[#1c2b22]">
        <p className="text-sm text-[#1c2b22]/60">Loading your account…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#faf6ec] px-6 font-sans text-[#1c2b22]">
        <div className="max-w-md rounded-sm border border-[#b8543a]/40 bg-[#efd9d4]/50 px-5 py-4 text-sm text-[#7a2e1c]">
          <p className="font-medium">Couldn&apos;t load your account.</p>
          <p className="mt-1 text-[#7a2e1c]/80">{error ?? "Unknown error."}</p>
        </div>
      </div>
    );
  }

  const { summary, savingsTrend, recentTransactions, loans } = data;

  return (
    <div className="w-full min-h-screen pt-4 mx-auto bg-[#faf6ec] font-sans text-[#1c2b22]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 border-b border-[#c9a24b]/40 pb-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
            My Account
          </p>
          <h1 className="font-serif text-3xl text-[#1c2b22]">
            Welcome back, {summary.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-[#1c2b22]/60">
            Member No. <span className="font-mono">{summary.memberNumber}</span> · Member since{" "}
            {formatDate(summary.memberSince)}
          </p>
        </header>

        {/* Balance cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BalanceCard
            icon={PiggyBank}
            label="Savings Balance"
            value={formatKes(summary.savingsBalance)}
            change={
              summary.savingsChangePct !== 0
                ? `${summary.savingsChangePct >= 0 ? "+" : ""}${summary.savingsChangePct.toFixed(1)}% this month`
                : undefined
            }
            trend={summary.savingsChangePct >= 0 ? "up" : "down"}
          />
          <BalanceCard
            icon={Wallet}
            label="Share Capital"
            value={formatKes(summary.shareCapital)}
          />
          <BalanceCard
            icon={Landmark}
            label="Active Loan Balance"
            value={formatKes(summary.activeLoanBalance)}
            sub={
              summary.nextLoanRepayment
                ? `Next: ${formatKes(summary.nextLoanRepayment.amount)} due ${formatDate(summary.nextLoanRepayment.dueDate)}`
                : summary.activeLoanBalance > 0
                  ? undefined
                  : "No active loan"
            }
          />
        </div>

        {/* Quick actions */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction icon={CreditCard} label="Make Deposit" href="/portal/member/payment" />
          <QuickAction icon={Send} label="Apply for Loan" href="/portal/member/loans/application/new" />
          <QuickAction icon={FileText} label="Statements" href="/portal/member/statement" />
          <QuickAction icon={Download} label="Loan Calculator" href="/member/passbook" />
        </div>

        {/* Savings trend + loans */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5 lg:col-span-2">
            <p className="text-xs uppercase tracking-wide text-[#1c2b22]/55">Growth Trend</p>
            <h2 className="mb-4 font-serif text-lg text-[#1c2b22]">Your Savings, Last 7 Months</h2>
            {savingsTrend.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#1c2b22]/45">
                No savings history yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={savingsTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="memberSavingsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1c2b22" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#1c2b22" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c9a24b" strokeOpacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#1c2b2299" }}
                    axisLine={{ stroke: "#c9a24b", strokeOpacity: 0.3 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#1c2b2299" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v / 1000}K`}
                  />
                  <Tooltip
                    formatter={(value) => [formatKes(Number(value ?? 0)), "Balance"]}
                    contentStyle={{
                      background: "#faf6ec",
                      border: "1px solid rgba(201,162,75,0.4)",
                      borderRadius: 2,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#1c2b22"
                    strokeWidth={2}
                    fill="url(#memberSavingsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Loans list */}
          <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5">
            <h2 className="mb-4 font-serif text-lg text-[#1c2b22]">Your Loans</h2>
            {loans.length === 0 ? (
              <p className="text-sm text-[#1c2b22]/45">You have no loans on record.</p>
            ) : (
              <ul className="space-y-3">
                {loans.map((loan) => (
                  <li
                    key={loan.loanId}
                    className="rounded-sm border border-[#c9a24b]/20 bg-[#faf6ec] p-3"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <span className="text-sm text-[#1c2b22]">{loan.productName}</span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${LOAN_STATUS_STYLE[loan.status]}`}
                      >
                        {loan.status}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-[#1c2b22]">
                      {formatKes(loan.outstandingBalance)}
                    </p>
                    {loan.nextDueDate && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[#1c2b22]/50">
                        <Clock size={11} />
                        Next due {formatDate(loan.nextDueDate)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg text-[#1c2b22]">Recent Transactions</h2>
            <a
              href="/member/statements"
              className="flex items-center gap-1 text-xs font-medium text-[#c9a24b] hover:underline"
            >
              View full statement
              <ArrowRight size={12} />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
                  {["Date", "Description", "Type", "Amount", "Balance"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left font-serif text-[13px] font-normal tracking-wide text-[#1c2b22]/70"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-[#1c2b22]/45">
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]">
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-[#1c2b22]/60">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-3 py-3 text-[#1c2b22]">{tx.description}</td>
                      <td className="px-3 py-3 text-[#1c2b22]/70">{TRANSACTION_LABEL[tx.type]}</td>
                      <td
                        className={`px-3 py-3 font-mono text-[13px] ${
                          tx.amount >= 0 ? "text-[#5c7a5f]" : "text-[#b8543a]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {tx.amount >= 0 ? (
                            <ArrowUpRight size={12} />
                          ) : (
                            <ArrowDownRight size={12} />
                          )}
                          {formatKes(Math.abs(tx.amount))}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[13px] text-[#1c2b22]">
                        {formatKes(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Sub-components & helpers
   ──────────────────────────────────────────────────────────── */

function BalanceCard({
  icon: Icon,
  label,
  value,
  sub,
  change,
  trend,
}: {
  icon: typeof PiggyBank;
  label: string;
  value: string;
  sub?: string;
  change?: string;
  trend?: "up" | "down";
}) {
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6] p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{label}</span>
        <div className="rounded-sm border border-[#c9a24b]/30 bg-[#faf6ec] p-1.5">
          <Icon size={14} className="text-[#1c2b22]/60" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-2xl leading-none text-[#1c2b22]">{value}</span>
        {change && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-medium ${
              trend === "up" ? "text-[#5c7a5f]" : "text-[#b8543a]"
            }`}
          >
            <TrendIcon size={13} />
            {change}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-[11px] text-[#1c2b22]/45">{sub}</p>}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof CreditCard;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 rounded-sm border border-[#c9a24b]/30 bg-white p-4 text-center transition-colors hover:bg-[#eee7d6]"
    >
      <div className="rounded-full border border-[#c9a24b]/40 bg-[#faf6ec] p-2.5">
        <Icon size={16} className="text-[#1c2b22]" />
      </div>
      <span className="text-xs font-medium text-[#1c2b22]">{label}</span>
    </a>
  );
}

function formatKes(amount: number): number {
  // return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
return amount;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}