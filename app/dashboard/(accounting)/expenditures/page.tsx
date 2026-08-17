"use client";

/**
 * Expenditure Register — SaccoFX Pro
 *
 * Tracks operational expenses (rent, salaries, utilities, levies, etc.) as
 * distinct from member-facing transactions (loans/savings). Follows the
 * passbook/ledger visual identity locked across the app:
 *   ink-green #1c2b22 · cream #faf6ec · parchment #eee7d6 · brass gold #c9a24b
 *   Serif headings, IBM Plex Mono for monetary/numeric values.
 *
 * This page ships with mock data + client-side state so it's drop-in
 * runnable. Wire it to real data by:
 *   1. Creating lib/expenditures.ts with getExpenditures/createExpenditure
 *      server actions (tenant id from verified JWT, never from params).
 *   2. Wrapping mutations in BEGIN/COMMIT/ROLLBACK per your existing
 *      convention for balance-mutating operations.
 *   3. Replacing the `useState(SEED)` below with data fetched server-side
 *      and passed in as a prop, keeping the filter/search logic client-side
 *      via useMemo (matches your member-list pattern).
 */

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Download,
  Receipt,
  TrendingDown,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ExpenditureStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

type PaymentMethod = "Cash" | "Cheque" | "M-Pesa" | "Bank Transfer";

interface Expenditure {
  id: string;
  voucherNo: string;
  date: string; // ISO date
  category: string;
  description: string;
  vendor: string;
  amount: number;
  method: PaymentMethod;
  status: ExpenditureStatus;
  approvedBy: string | null;
}

const CATEGORIES = [
  "Staff Salaries",
  "Rent & Premises",
  "Utilities",
  "Stationery & Supplies",
  "Staff Training",
  "Bank & Transaction Charges",
  "Audit & Professional Fees",
  "IT & Software",
  "Transport & Travel",
  "Marketing & Member Outreach",
  "SASRA Levies & Statutory",
  "Insurance",
  "Repairs & Maintenance",
] as const;

const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "Cheque",
  "M-Pesa",
  "Bank Transfer",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Staff Salaries": "#1c2b22",
  "Rent & Premises": "#c9a24b",
  Utilities: "#7a8b74",
  "Stationery & Supplies": "#a8825c",
  "Staff Training": "#5c7a6e",
  "Bank & Transaction Charges": "#8b6f47",
  "Audit & Professional Fees": "#3f5344",
  "IT & Software": "#b08d3e",
  "Transport & Travel": "#6b7d63",
  "Marketing & Member Outreach": "#9c7a3f",
  "SASRA Levies & Statutory": "#2f4235",
  Insurance: "#8a9184",
  "Repairs & Maintenance": "#79643f",
};

// ---------------------------------------------------------------------------
// Seed data (replace with server-fetched data)
// ---------------------------------------------------------------------------

const SEED: Expenditure[] = [
  {
    id: "1",
    voucherNo: "EXP-2026-0091",
    date: "2026-08-15",
    category: "Staff Salaries",
    description: "August payroll — 12 staff",
    vendor: "Internal — Payroll",
    amount: 486000,
    method: "Bank Transfer",
    status: "PAID",
    approvedBy: "J. Mwangi",
  },
  {
    id: "2",
    voucherNo: "EXP-2026-0092",
    date: "2026-08-14",
    category: "Rent & Premises",
    description: "Branch office rent — August",
    vendor: "Kilimani Plaza Ltd",
    amount: 95000,
    method: "Bank Transfer",
    status: "PAID",
    approvedBy: "J. Mwangi",
  },
  {
    id: "3",
    voucherNo: "EXP-2026-0093",
    date: "2026-08-13",
    category: "SASRA Levies & Statutory",
    description: "Quarterly SASRA supervision levy",
    vendor: "SASRA",
    amount: 62500,
    method: "Bank Transfer",
    status: "APPROVED",
    approvedBy: "F. Odhiambo",
  },
  {
    id: "4",
    voucherNo: "EXP-2026-0094",
    date: "2026-08-12",
    category: "Utilities",
    description: "KPLC electricity — main branch",
    vendor: "Kenya Power",
    amount: 14300,
    method: "M-Pesa",
    status: "PAID",
    approvedBy: "F. Odhiambo",
  },
  {
    id: "5",
    voucherNo: "EXP-2026-0095",
    date: "2026-08-11",
    category: "IT & Software",
    description: "Africa's Talking SMS top-up",
    vendor: "Africa's Talking",
    amount: 20000,
    method: "M-Pesa",
    status: "PAID",
    approvedBy: "J. Mwangi",
  },
  {
    id: "6",
    voucherNo: "EXP-2026-0096",
    date: "2026-08-10",
    category: "Stationery & Supplies",
    description: "Passbooks, receipt books, toner",
    vendor: "Text Book Centre",
    amount: 8750,
    method: "Cash",
    status: "PENDING",
    approvedBy: null,
  },
  {
    id: "7",
    voucherNo: "EXP-2026-0097",
    date: "2026-08-08",
    category: "Transport & Travel",
    description: "Field officer fuel & mileage",
    vendor: "Shell Yaya",
    amount: 6200,
    method: "Cash",
    status: "PENDING",
    approvedBy: null,
  },
  {
    id: "8",
    voucherNo: "EXP-2026-0098",
    date: "2026-08-06",
    category: "Audit & Professional Fees",
    description: "Interim audit review — Q2",
    vendor: "Mwangi & Associates",
    amount: 120000,
    method: "Cheque",
    status: "REJECTED",
    approvedBy: "F. Odhiambo",
  },
  {
    id: "9",
    voucherNo: "EXP-2026-0099",
    date: "2026-08-05",
    category: "Marketing & Member Outreach",
    description: "Member education day — banners & venue",
    vendor: "Print Masters",
    amount: 17500,
    method: "Bank Transfer",
    status: "APPROVED",
    approvedBy: "J. Mwangi",
  },
  {
    id: "10",
    voucherNo: "EXP-2026-0100",
    date: "2026-08-03",
    category: "Repairs & Maintenance",
    description: "AC servicing — banking hall",
    vendor: "CoolAir Kenya",
    amount: 9800,
    method: "Cash",
    status: "PAID",
    approvedBy: "F. Odhiambo",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatKES = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const STAMP_STYLES: Record<
  ExpenditureStatus,
  { border: string; text: string; rotate: string }
> = {
  PENDING: { border: "border-[#c9a24b]", text: "text-[#8b6f2f]", rotate: "-rotate-2" },
  APPROVED: { border: "border-[#3f5344]", text: "text-[#3f5344]", rotate: "rotate-1" },
  PAID: { border: "border-[#1c2b22]", text: "text-[#1c2b22]", rotate: "-rotate-1" },
  REJECTED: { border: "border-[#8b2e2e]", text: "text-[#8b2e2e]", rotate: "rotate-2" },
};

function StatusStamp({ status }: { status: ExpenditureStatus }) {
  const s = STAMP_STYLES[status];
  return (
    <span
      className={`inline-block select-none border-2 ${s.border} ${s.text} ${s.rotate} px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest opacity-90`}
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Expense modal
// ---------------------------------------------------------------------------

function AddExpenseModal({
  onClose,
  onSave,
  nextVoucherNo,
}: {
  onClose: () => void;
  onSave: (e: Expenditure) => void;
  nextVoucherNo: string;
}) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const canSave = description.trim() && vendor.trim() && Number(amount) > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: crypto.randomUUID(),
      voucherNo: nextVoucherNo,
      date,
      category,
      description: description.trim(),
      vendor: vendor.trim(),
      amount: Number(amount),
      method,
      status: "PENDING",
      approvedBy: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md border border-[#c9a24b]/40 bg-[#faf6ec] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1c2b22]/15 bg-[#1c2b22] px-5 py-4">
          <h2
            className="text-lg text-[#faf6ec]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Record Expenditure
          </h2>
          <button
            onClick={onClose}
            className="text-[#faf6ec]/70 transition hover:text-[#c9a24b]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
              Voucher No.
            </label>
            <div
              className="border border-[#1c2b22]/15 bg-[#eee7d6] px-3 py-2 text-sm text-[#1c2b22]/60"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {nextVoucherNo}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this expense for?"
              className="w-full border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
              Vendor / Payee
            </label>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Who is being paid?"
              className="w-full border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
                Amount (KES)
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#1c2b22]/15 px-5 py-4">
          <button
            onClick={onClose}
            className="border border-[#1c2b22]/30 px-4 py-2 text-sm font-medium text-[#1c2b22] transition hover:bg-[#1c2b22]/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-[#2a3d30] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save as Pending
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExpenditurePage() {
  const [expenditures, setExpenditures] = useState<Expenditure[]>(SEED);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenditures
      .filter((e) => (categoryFilter === "All" ? true : e.category === categoryFilter))
      .filter((e) => (statusFilter === "All" ? true : e.status === statusFilter))
      .filter((e) =>
        q
          ? e.description.toLowerCase().includes(q) ||
            e.vendor.toLowerCase().includes(q) ||
            e.voucherNo.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenditures, search, categoryFilter, statusFilter]);

  const totals = useMemo(() => {
    const paidOrApproved = expenditures.filter(
      (e) => e.status === "PAID" || e.status === "APPROVED"
    );
    const monthTotal = paidOrApproved.reduce((sum, e) => sum + e.amount, 0);
    const pending = expenditures.filter((e) => e.status === "PENDING");
    const pendingTotal = pending.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = new Map<string, number>();
    for (const e of paidOrApproved) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      monthTotal,
      pendingCount: pending.length,
      pendingTotal,
      topCategory: topCategory ? topCategory[0] : "—",
      chartData: [...byCategory.entries()].map(([name, value]) => ({ name, value })),
    };
  }, [expenditures]);

  const nextVoucherNo = `EXP-2026-${String(101 + expenditures.length - 10).padStart(4, "0")}`;

  return (
    <div className="min-h-screen bg-[#faf6ec] pb-16">
      {/* Header */}
      <div className="border-b border-[#1c2b22]/15 bg-[#1c2b22] px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c9a24b]">
              Ledger · Operational Costs
            </p>
            <h1
              className="mt-1 text-3xl text-[#faf6ec]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Expenditure Register
            </h1>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 border border-[#faf6ec]/25 px-4 py-2 text-sm font-medium text-[#faf6ec]/90 transition hover:bg-[#faf6ec]/10">
              <Download size={15} />
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#c9a24b] px-4 py-2 text-sm font-semibold text-[#1c2b22] transition hover:bg-[#d9b25e]"
            >
              <Plus size={15} />
              Record Expense
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        {/* Summary cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="border border-[#1c2b22]/12 bg-white px-5 py-4">
            <div className="flex items-center gap-2 text-[#1c2b22]/60">
              <TrendingDown size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Total Expenditure (MTD)
              </span>
            </div>
            <p
              className="mt-2 text-2xl text-[#1c2b22]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {formatKES(totals.monthTotal)}
            </p>
          </div>

          <div className="border border-[#1c2b22]/12 bg-white px-5 py-4">
            <div className="flex items-center gap-2 text-[#1c2b22]/60">
              <Clock size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Pending Approval
              </span>
            </div>
            <p
              className="mt-2 text-2xl text-[#1c2b22]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {formatKES(totals.pendingTotal)}
            </p>
            <p className="mt-0.5 text-xs text-[#1c2b22]/50">
              {totals.pendingCount} voucher{totals.pendingCount === 1 ? "" : "s"} awaiting sign-off
            </p>
          </div>

          <div className="border border-[#1c2b22]/12 bg-white px-5 py-4">
            <div className="flex items-center gap-2 text-[#1c2b22]/60">
              <CheckCircle2 size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Largest Category
              </span>
            </div>
            <p
              className="mt-2 text-lg text-[#1c2b22]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {totals.topCategory}
            </p>
          </div>
        </div>

        {/* Category breakdown + filters */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="border border-[#1c2b22]/12 bg-white p-5 lg:col-span-1">
            <h3
              className="mb-2 text-sm font-semibold text-[#1c2b22]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              By Category
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={totals.chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {totals.chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CATEGORY_COLORS[entry.name] ?? "#c9a24b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatKES(Number(value))}
                    contentStyle={{
                      background: "#faf6ec",
                      border: "1px solid #1c2b22",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-[#1c2b22]/12 bg-white p-5 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Filter size={14} className="text-[#1c2b22]/50" />
              <h3
                className="text-sm font-semibold text-[#1c2b22]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Filter Vouchers
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1c2b22]/40"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Vendor, voucher, description…"
                  className="w-full border border-[#1c2b22]/20 bg-[#faf6ec] py-2 pl-8 pr-3 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-[#1c2b22]/20 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
              >
                <option value="All">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-[#1c2b22]/20 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] outline-none focus:border-[#c9a24b]"
              >
                <option value="All">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <p className="mt-3 text-xs text-[#1c2b22]/45">
              {filtered.length} of {expenditures.length} vouchers shown
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto border border-[#1c2b22]/12 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#1c2b22]/15 bg-[#eee7d6] text-[11px] font-semibold uppercase tracking-wide text-[#1c2b22]/70">
                <th className="px-4 py-3">Voucher</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#1c2b22]/50">
                    No vouchers match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((e, i) => (
                <tr
                  key={e.id}
                  className={`border-b border-[#1c2b22]/8 ${
                    i % 2 === 0 ? "bg-white" : "bg-[#faf6ec]/60"
                  } hover:bg-[#eee7d6]/60`}
                >
                  <td
                    className="px-4 py-3 text-[#1c2b22]/70"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Receipt size={12} className="text-[#c9a24b]" />
                      {e.voucherNo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#1c2b22]/80">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 text-[#1c2b22]/80">{e.category}</td>
                  <td className="px-4 py-3 text-[#1c2b22]">{e.description}</td>
                  <td className="px-4 py-3 text-[#1c2b22]/70">{e.vendor}</td>
                  <td className="px-4 py-3 text-[#1c2b22]/70">{e.method}</td>
                  <td
                    className="px-4 py-3 text-right font-medium text-[#1c2b22]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {formatKES(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusStamp status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#1c2b22]/20 bg-[#eee7d6]">
                  <td colSpan={6} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#1c2b22]/70">
                    Total (filtered)
                  </td>
                  <td
                    className="px-4 py-3 text-right text-sm font-bold text-[#1c2b22]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {formatKES(filtered.reduce((s, e) => s + e.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddExpenseModal
          onClose={() => setShowAddModal(false)}
          onSave={(e) => setExpenditures((prev) => [e, ...prev])}
          nextVoucherNo={nextVoucherNo}
        />
      )}
    </div>
  );
}