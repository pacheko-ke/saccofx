"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  PiggyBank,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

interface Kpi {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: typeof Users;
  sub?: string;
}

interface ActivityItem {
  user: string;
  action: string;
  time: string;
}

interface MemberRow {
  id: string;
  name: string;
  amount: string;
  status: "Active" | "Pending" | "Suspended";
}

interface SavingsPoint {
  month: string;
  savings: number;
  shareCapital: number;
}

interface CashflowPoint {
  month: string;
  deposits: number;
  withdrawals: number;
}

interface PortfolioSlice {
  name: string;
  value: number;
}

/* ────────────────────────────────────────────────────────────
   Demo fallback data
   ──────────────────────────────────────────────────────────── */

const DEMO_KPIS: Kpi[] = [
  { label: "Total Savings", value: "KES 99.98M", change: "+0.9%", trend: "up", icon: PiggyBank },
  { label: "Share Capital", value: "KES 48.29M", change: "+12.4%", trend: "up", icon: Wallet },
  { label: "Active Members", value: "834", change: "+4.2%", trend: "up", icon: Users },
  { label: "Active Loans", value: "312", change: "-2.1%", trend: "down", icon: Landmark },
  { label: "Portfolio at Risk", value: "6.8%", change: "+1.1pp", trend: "down", sub: "PAR > 30 days", icon: ShieldAlert },
  { label: "Disbursed (MTD)", value: "KES 5.62M", change: "+18.0%", trend: "up", icon: TrendingUp },
];

const DEMO_ACTIVITY: ActivityItem[] = [
  { user: "Mary", action: "approved loan LN-2026-00842", time: "2m ago" },
  { user: "Samuel", action: "registered a new member", time: "18m ago" },
  { user: "Geoffrey", action: "declined loan application LN-2026-00839", time: "1h ago" },
  { user: "Faith", action: "posted a repayment via M-Pesa", time: "2h ago" },
  { user: "John", action: "reversed a duplicate journal entry", time: "3h ago" },
];

const DEMO_MEMBERS: MemberRow[] = [
  { id: "SFX-2311", name: "Patrick Mutua", amount: "KES 1,240", status: "Active" },
  { id: "SFX-2310", name: "Joshua Kariuki", amount: "KES 890", status: "Pending" },
  { id: "SFX-2309", name: "Janet Wambui", amount: "KES 2,150", status: "Active" },
  { id: "SFX-2308", name: "Maria Nafula", amount: "KES 430", status: "Active" },
];

const DEMO_SAVINGS_TREND: SavingsPoint[] = [
  { month: "Feb", savings: 82.1, shareCapital: 39.4 },
  { month: "Mar", savings: 85.6, shareCapital: 41.0 },
  { month: "Apr", savings: 88.9, shareCapital: 42.6 },
  { month: "May", savings: 91.4, shareCapital: 44.1 },
  { month: "Jun", savings: 95.2, shareCapital: 46.0 },
  { month: "Jul", savings: 97.8, shareCapital: 47.3 },
  { month: "Aug", savings: 99.98, shareCapital: 48.29 },
];

const DEMO_CASHFLOW: CashflowPoint[] = [
  { month: "Feb", deposits: 9.8, withdrawals: 6.1 },
  { month: "Mar", deposits: 10.4, withdrawals: 6.9 },
  { month: "Apr", deposits: 11.1, withdrawals: 7.4 },
  { month: "May", deposits: 10.7, withdrawals: 7.0 },
  { month: "Jun", deposits: 12.3, withdrawals: 7.8 },
  { month: "Jul", deposits: 11.9, withdrawals: 8.2 },
  { month: "Aug", deposits: 12.6, withdrawals: 7.6 },
];

const DEMO_PORTFOLIO: PortfolioSlice[] = [
  { name: "Performing", value: 249 },
  { name: "Watch", value: 34 },
  { name: "Substandard", value: 15 },
  { name: "Doubtful", value: 9 },
  { name: "Loss", value: 5 },
];

const PORTFOLIO_COLORS = ["#5c7a5f", "#c9a24b", "#b8834a", "#b8543a", "#7a2e1c"];

const STATUS_STYLE: Record<MemberRow["status"], string> = {
  Active: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
  Pending: "bg-[#f3e6c4] text-[#7a5a12] border-[#c9a24b]/60",
  Suspended: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
};

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpi[]>(DEMO_KPIS);
  const [activity, setActivity] = useState<ActivityItem[]>(DEMO_ACTIVITY);
  const [members, setMembers] = useState<MemberRow[]>(DEMO_MEMBERS);
  const [savingsTrend, setSavingsTrend] = useState<SavingsPoint[]>(DEMO_SAVINGS_TREND);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>(DEMO_CASHFLOW);
  const [portfolio, setPortfolio] = useState<PortfolioSlice[]>(DEMO_PORTFOLIO);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error("Dashboard API unavailable");
        const data = await res.json();
        if (!cancelled) {
          setKpis(data.kpis);
          setActivity(data.activity);
          setMembers(data.members);
          setSavingsTrend(data.savingsTrend);
          setCashflow(data.cashflow);
          setPortfolio(data.portfolio);
        }
      } catch {
        if (!cancelled) setUsingDemoData(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalLoans = useMemo(() => portfolio.reduce((s, p) => s + p.value, 0), [portfolio]);

  return (
    <div className="min-h-screen bg-[#faf6ec] font-sans text-[#1c2b22]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 border-b border-[#c9a24b]/40 pb-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
            Overview
          </p>
          <h1 className="font-serif text-3xl text-[#1c2b22]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#1c2b22]/60">
            A snapshot of your SACCO's savings, loans, and membership activity.
          </p>
        </header>

        {usingDemoData && (
          <div className="mb-6 rounded-sm border border-[#c9a24b]/50 bg-[#f3e6c4]/50 px-4 py-2.5 text-sm text-[#7a5a12]">
            Showing sample data — couldn't reach <code className="font-mono">/api/dashboard</code>.
            Connect the reporting endpoint to see live figures.
          </div>
        )}

        {/* KPI cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>

        {/* Charts row */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Savings & share capital growth */}
          <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#1c2b22]/55">Growth Trend</p>
                <h2 className="font-serif text-lg text-[#1c2b22]">Savings &amp; Share Capital</h2>
              </div>
              <div className="flex gap-4 text-xs">
                <LegendDot color="#1c2b22" label="Savings" />
                <LegendDot color="#c9a24b" label="Share Capital" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={savingsTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1c2b22" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#1c2b22" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="shareFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a24b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c9a24b" stopOpacity={0} />
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
                  tickFormatter={(v) => `${v}M`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `KES ${Number(value ?? 0).toFixed(2)}M`,
                    name === "savings" ? "Savings" : "Share Capital",
                  ]}
                  contentStyle={{
                    background: "#faf6ec",
                    border: "1px solid rgba(201,162,75,0.4)",
                    borderRadius: 2,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="savings" stroke="#1c2b22" strokeWidth={2} fill="url(#savingsFill)" />
                <Area type="monotone" dataKey="shareCapital" stroke="#c9a24b" strokeWidth={2} fill="url(#shareFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Loan portfolio composition */}
          <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-[#1c2b22]/55">Loan Book</p>
            <h2 className="mb-4 font-serif text-lg text-[#1c2b22]">Portfolio Composition</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={portfolio}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="#faf6ec"
                  strokeWidth={2}
                >
                  {portfolio.map((slice, i) => (
                    <Cell key={slice.name} fill={PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const n = Number(value ?? 0);
                    return [`${n} loans (${((n / totalLoans) * 100).toFixed(1)}%)`, name];
                  }}
                  contentStyle={{
                    background: "#faf6ec",
                    border: "1px solid rgba(201,162,75,0.4)",
                    borderRadius: 2,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {portfolio.map((slice, i) => (
                <div key={slice.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length] }}
                    />
                    <span className="text-[#1c2b22]/70">{slice.name}</span>
                  </div>
                  <span className="font-mono text-[#1c2b22]">{slice.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cashflow + activity + members */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Deposits vs withdrawals */}
          <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#1c2b22]/55">Cash Movement</p>
                <h2 className="font-serif text-lg text-[#1c2b22]">Deposits vs Withdrawals</h2>
              </div>
              <div className="flex gap-4 text-xs">
                <LegendDot color="#5c7a5f" label="Deposits" />
                <LegendDot color="#b8543a" label="Withdrawals" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cashflow} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={4}>
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
                  tickFormatter={(v) => `${v}M`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `KES ${Number(value ?? 0).toFixed(2)}M`,
                    name === "deposits" ? "Deposits" : "Withdrawals",
                  ]}
                  contentStyle={{
                    background: "#faf6ec",
                    border: "1px solid rgba(201,162,75,0.4)",
                    borderRadius: 2,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="deposits" fill="#5c7a5f" radius={[2, 2, 0, 0]} />
                <Bar dataKey="withdrawals" fill="#b8543a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent activity */}
          <div className="rounded-sm border border-[#c9a24b]/30 bg-white p-5">
            <h2 className="mb-4 font-serif text-lg text-[#1c2b22]">Recent Activity</h2>
            <ul className="space-y-4">
              {activity.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c9a24b]/40 bg-[#eee7d6] font-serif text-xs text-[#1c2b22]">
                    {item.user
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#1c2b22]">
                      <span className="font-medium">{item.user}</span>{" "}
                      <span className="text-[#1c2b22]/70">{item.action}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-[#1c2b22]/45">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recent members */}
        <div className="mt-6 rounded-sm border border-[#c9a24b]/30 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg text-[#1c2b22]">Recent Members</h2>
            <a
              href="#"
              className="text-sm text-[#c9a24b] underline underline-offset-4 hover:text-[#a9843c]"
            >
              View all
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
                  {["Member ID", "Name", "Amount", "Status"].map((h) => (
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
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]">
                    <td className="px-3 py-3 font-mono text-[13px] text-[#1c2b22]/60">{m.id}</td>
                    <td className="px-3 py-3 text-[#1c2b22]">{m.name}</td>
                    <td className="px-3 py-3 font-mono text-[13px] text-[#1c2b22]">{m.amount}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLE[m.status]}`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon;
  const TrendIcon = kpi.trend === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{kpi.label}</span>
        <div className="rounded-sm border border-[#c9a24b]/30 bg-[#faf6ec] p-1.5">
          <Icon size={14} className="text-[#1c2b22]/60" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-xl leading-none text-[#1c2b22]">{kpi.value}</span>
        <span
          className={`flex items-center gap-0.5 text-[11px] font-medium ${
            kpi.trend === "up" ? "text-[#5c7a5f]" : "text-[#b8543a]"
          }`}
        >
          <TrendIcon size={13} />
          {kpi.change}
        </span>
      </div>
      {kpi.sub && <p className="mt-1 text-[11px] text-[#1c2b22]/45">{kpi.sub}</p>}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[#1c2b22]/60">{label}</span>
    </div>
  );
}