"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Wallet,
  Landmark,
  TrendingUp,
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
} from "recharts";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

// The API sends a string key for the icon (JSON can't carry a component
// reference) — this maps it back to the actual lucide component client-side.
const ICONS = {
  PiggyBank,
  Wallet,
  Users,
  Landmark,
  ShieldAlert,
  TrendingUp,
} as const;

type KpiIconKey = keyof typeof ICONS;

interface Kpi {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: KpiIconKey;
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

interface DashboardData {
  kpis: Kpi[];
  activity: ActivityItem[];
  members: MemberRow[];
  savingsTrend: SavingsPoint[];
  cashflow: CashflowPoint[];
  portfolio: PortfolioSlice[];
}

const STATUS_STYLE: Record<MemberRow["status"], string> = {
  Active: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
  Pending: "bg-[#f3e6c4] text-[#7a5a12] border-[#c9a24b]/60",
  Suspended: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
};

const PORTFOLIO_COLORS = ["#5c7a5f", "#c9a24b", "#b8834a", "#b8543a", "#7a2e1c"];

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/v1/dashboard");

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Dashboard API returned ${res.status}`);
        }

        const json = (await res.json()) as DashboardData;

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data");
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

  const portfolio = data?.portfolio ?? [];
  const totalLoans = useMemo(() => portfolio.reduce((s, p) => s + p.value, 0), [portfolio]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#faf6ec] font-sans text-[#1c2b22]">
        <p className="text-sm text-[#1c2b22]/60">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#faf6ec] px-6 font-sans text-[#1c2b22]">
        <div className="max-w-md rounded-sm border border-[#b8543a]/40 bg-[#efd9d4]/50 px-5 py-4 text-sm text-[#7a2e1c]">
          <p className="font-medium">Couldn&apos;t load the dashboard.</p>
          <p className="mt-1 text-[#7a2e1c]/80">{error ?? "Unknown error."}</p>
        </div>
      </div>
    );
  }

  const { kpis, activity, members, savingsTrend, cashflow } = data;

  return (
    <div className="w-full min-h-screen pt-4 md:pl-0 mx-auto bg-[#faf6ec] font-sans text-[#1c2b22]">
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
                    const pct = totalLoans === 0 ? 0 : (n / totalLoans) * 100;
                    return [`${n} loans (${pct.toFixed(1)}%)`, name];
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
            {activity.length === 0 ? (
              <p className="text-sm text-[#1c2b22]/50">No recent activity.</p>
            ) : (
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
            )}
          </div>
        </div>

        {/* Recent members */}
        <div className="mt-6 rounded-sm border border-[#c9a24b]/30 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg text-[#1c2b22]">Recent Members</h2>
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
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-[#1c2b22]/50">
                      No members yet.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
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
   Sub-components
   ──────────────────────────────────────────────────────────── */

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = ICONS[kpi.icon] ?? Users;
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
        {kpi.change && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-medium ${
              kpi.trend === "up" ? "text-[#5c7a5f]" : "text-[#b8543a]"
            }`}
          >
            <TrendIcon size={13} />
            {kpi.change}
          </span>
        )}
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