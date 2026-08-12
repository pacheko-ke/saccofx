"use client";

import { useEffect, useMemo, useState } from "react";

/* ────────────────────────────────────────────────────────────
   Types — mirror the FeeType / FeeCharge Prisma models
   ──────────────────────────────────────────────────────────── */

type FeeCategory =
  | "LOAN"
  | "SAVINGS"
  | "ACCOUNT"
  | "TRANSACTION"
  | "MEMBERSHIP"
  | "PENALTY";

type FeeCalculationType = "FLAT" | "PERCENTAGE" | "TIERED";

type FeeChargeStatus = "PENDING" | "PAID" | "WAIVED" | "REVERSED";

interface FeeType {
  id: string;
  code: string;
  name: string;
  category: FeeCategory;
  calculationType: FeeCalculationType;
  flatAmount: number | null;
  percentageRate: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
  updatedAt: string;
}

interface FeeCharge {
  id: string;
  feeTypeId: string;
  feeTypeName: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  amount: number;
  status: FeeChargeStatus;
  dueDate: string | null;
  paidDate: string | null;
  createdAt: string;
}

/* ────────────────────────────────────────────────────────────
   Demo fallback data — used only if the API call fails,
   so the page still renders something sensible in dev
   ──────────────────────────────────────────────────────────── */

const DEMO_FEE_TYPES: FeeType[] = [
  {
    id: "1",
    code: "LOAN_PROCESSING",
    name: "Loan Processing Fee",
    category: "LOAN",
    calculationType: "PERCENTAGE",
    flatAmount: null,
    percentageRate: 0.025,
    minAmount: 200,
    maxAmount: 5000,
    isActive: true,
    updatedAt: "2026-07-14",
  },
  {
    id: "2",
    code: "WITHDRAWAL_FEE",
    name: "Savings Withdrawal Fee",
    category: "TRANSACTION",
    calculationType: "TIERED",
    flatAmount: null,
    percentageRate: null,
    minAmount: null,
    maxAmount: null,
    isActive: true,
    updatedAt: "2026-06-02",
  },
  {
    id: "3",
    code: "ACCOUNT_MAINTENANCE",
    name: "Monthly Account Maintenance",
    category: "ACCOUNT",
    calculationType: "FLAT",
    flatAmount: 50,
    percentageRate: null,
    minAmount: null,
    maxAmount: null,
    isActive: true,
    updatedAt: "2026-05-20",
  },
  {
    id: "4",
    code: "LATE_PAYMENT_PENALTY",
    name: "Late Loan Repayment Penalty",
    category: "PENALTY",
    calculationType: "PERCENTAGE",
    flatAmount: null,
    percentageRate: 0.05,
    minAmount: 100,
    maxAmount: null,
    isActive: true,
    updatedAt: "2026-04-11",
  },
  {
    id: "5",
    code: "MEMBERSHIP_ENTRY",
    name: "New Membership Entry Fee",
    category: "MEMBERSHIP",
    calculationType: "FLAT",
    flatAmount: 1000,
    percentageRate: null,
    minAmount: null,
    maxAmount: null,
    isActive: false,
    updatedAt: "2026-01-30",
  },
];

const DEMO_CHARGES: FeeCharge[] = [
  {
    id: "c1",
    feeTypeId: "1",
    feeTypeName: "Loan Processing Fee",
    memberId: "m1",
    memberName: "Wanjiru Kamau",
    memberNumber: "SFX-2201",
    amount: 3250,
    status: "PAID",
    dueDate: "2026-08-01",
    paidDate: "2026-08-01",
    createdAt: "2026-07-30",
  },
  {
    id: "c2",
    feeTypeId: "3",
    feeTypeName: "Monthly Account Maintenance",
    memberId: "m2",
    memberName: "Otieno Owuor",
    memberNumber: "SFX-1875",
    amount: 50,
    status: "PENDING",
    dueDate: "2026-08-31",
    paidDate: null,
    createdAt: "2026-08-01",
  },
  {
    id: "c3",
    feeTypeId: "4",
    feeTypeName: "Late Loan Repayment Penalty",
    memberId: "m3",
    memberName: "Achieng Odhiambo",
    memberNumber: "SFX-2044",
    amount: 620,
    status: "WAIVED",
    dueDate: "2026-07-15",
    paidDate: null,
    createdAt: "2026-07-16",
  },
  {
    id: "c4",
    feeTypeId: "2",
    feeTypeName: "Savings Withdrawal Fee",
    memberId: "m4",
    memberName: "Kiplagat Rono",
    memberNumber: "SFX-1990",
    amount: 30,
    status: "PAID",
    dueDate: "2026-08-05",
    paidDate: "2026-08-05",
    createdAt: "2026-08-05",
  },
  {
    id: "c5",
    feeTypeId: "1",
    feeTypeName: "Loan Processing Fee",
    memberId: "m5",
    memberName: "Nyambura Gitau",
    memberNumber: "SFX-2110",
    amount: 4100,
    status: "REVERSED",
    dueDate: "2026-06-20",
    paidDate: "2026-06-20",
    createdAt: "2026-06-18",
  },
];

/* ────────────────────────────────────────────────────────────
   Small display helpers
   ──────────────────────────────────────────────────────────── */

const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const CATEGORY_LABEL: Record<FeeCategory, string> = {
  LOAN: "Loan",
  SAVINGS: "Savings",
  ACCOUNT: "Account",
  TRANSACTION: "Transaction",
  MEMBERSHIP: "Membership",
  PENALTY: "Penalty",
};

const STATUS_STYLE: Record<FeeChargeStatus, string> = {
  PENDING: "bg-[#f3e6c4] text-[#7a5a12] border-[#c9a24b]/60",
  PAID: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
  WAIVED: "bg-[#e4e0d6] text-[#5c5646] border-[#a89f87]/50",
  REVERSED: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
};

function StatusPill({ status }: { status: FeeChargeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase font-sans ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function feeAmountLabel(f: FeeType) {
  if (f.calculationType === "FLAT" && f.flatAmount != null) {
    return KES.format(f.flatAmount);
  }
  if (f.calculationType === "PERCENTAGE" && f.percentageRate != null) {
    const pct = `${(f.percentageRate * 100).toFixed(2)}%`;
    if (f.minAmount != null || f.maxAmount != null) {
      const min = f.minAmount != null ? KES.format(f.minAmount) : "—";
      const max = f.maxAmount != null ? KES.format(f.maxAmount) : "no cap";
      return `${pct} (min ${min} / max ${max})`;
    }
    return pct;
  }
  if (f.calculationType === "TIERED") return "Tiered — by amount band";
  return "—";
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

type Tab = "types" | "charges";

export default function ChargesAndFeesPage() {
  const [tab, setTab] = useState<Tab>("types");
  const [feeTypes, setFeeTypes] = useState<FeeType[]>(DEMO_FEE_TYPES);
  const [charges, setCharges] = useState<FeeCharge[]>(DEMO_CHARGES);
  const [loading, setLoading] = useState(true);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FeeCategory | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<FeeChargeStatus | "ALL">("ALL");
  const [showNewFeeForm, setShowNewFeeForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [typesRes, chargesRes] = await Promise.all([
          fetch("/api/fees/types"),
          fetch("/api/fees/charges"),
        ]);
        if (!typesRes.ok || !chargesRes.ok) throw new Error("Fee API unavailable");
        const types = await typesRes.json();
        const chg = await chargesRes.json();
        if (!cancelled) {
          setFeeTypes(types);
          setCharges(chg);
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

  const filteredTypes = useMemo(() => {
    return feeTypes.filter((f) => {
      const matchesSearch =
        search.trim() === "" ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.code.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "ALL" || f.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [feeTypes, search, categoryFilter]);

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      const matchesSearch =
        search.trim() === "" ||
        c.memberName.toLowerCase().includes(search.toLowerCase()) ||
        c.memberNumber.toLowerCase().includes(search.toLowerCase()) ||
        c.feeTypeName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [charges, search, statusFilter]);

  const summary = useMemo(() => {
    const outstanding = charges
      .filter((c) => c.status === "PENDING")
      .reduce((sum, c) => sum + c.amount, 0);
    const collectedThisMonth = charges
      .filter((c) => c.status === "PAID")
      .reduce((sum, c) => sum + c.amount, 0);
    const waived = charges
      .filter((c) => c.status === "WAIVED")
      .reduce((sum, c) => sum + c.amount, 0);
    const activeTypes = feeTypes.filter((f) => f.isActive).length;
    return { outstanding, collectedThisMonth, waived, activeTypes };
  }, [charges, feeTypes]);

  return (
    <div className="min-h-screen bg-[#faf6ec] font-sans text-[#1c2b22] md:pl-12 pt-10">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-[#c9a24b]/40 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
              Ledger &amp; Compliance
            </p>
            <h1 className="font-serif text-3xl text-[#1c2b22]">Charges &amp; Fees</h1>
            <p className="mt-1 text-sm text-[#1c2b22]/60">
              Manage fee definitions and track charges applied to member accounts.
            </p>
          </div>
          <button
            onClick={() => setShowNewFeeForm(true)}
            className="inline-flex items-center justify-center rounded-sm border border-[#c9a24b] bg-[#1c2b22] px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-[#1c2b22]/90"
          >
            + New Fee Type
          </button>
        </header>

        {usingDemoData && (
          <div className="mb-6 rounded-sm border border-[#c9a24b]/50 bg-[#f3e6c4]/50 px-4 py-2.5 text-sm text-[#7a5a12]">
             Couldn't reach <code className="font-mono">/api/fees</code>.
            Connect the fee endpoints to see live figures.
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Outstanding" value={KES.format(summary.outstanding)} accent="pending" />
          <SummaryCard label="Collected" value={KES.format(summary.collectedThisMonth)} accent="paid" />
          <SummaryCard label="Waived" value={KES.format(summary.waived)} accent="waived" />
          <SummaryCard label="Active Fee Types" value={String(summary.activeTypes)} accent="neutral" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 border-b border-[#c9a24b]/30">
          <TabButton active={tab === "types"} onClick={() => setTab("types")}>
            Fee Types
          </TabButton>
          <TabButton active={tab === "charges"} onClick={() => setTab("charges")}>
            Charges Ledger
          </TabButton>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "types" ? "Search by name or code…" : "Search by member or fee…"}
            className="w-full max-w-xs rounded-sm border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#1c2b22]/40 focus:border-[#c9a24b] focus:outline-none"
          />
          {tab === "types" ? (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FeeCategory | "ALL")}
              className="rounded-sm border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none"
            >
              <option value="ALL">All categories</option>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FeeChargeStatus | "ALL")}
              className="rounded-sm border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
              <option value="REVERSED">Reversed</option>
            </select>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6] px-4 py-10 text-center text-sm text-[#1c2b22]/60">
            Loading…
          </div>
        ) : tab === "types" ? (
          <FeeTypesTable rows={filteredTypes} />
        ) : (
          <ChargesTable rows={filteredCharges} />
        )}
      </div>

      {showNewFeeForm && <NewFeeTypeModal onClose={() => setShowNewFeeForm(false)} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition ${
        active ? "text-[#1c2b22]" : "text-[#1c2b22]/50 hover:text-[#1c2b22]/80"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#c9a24b]" aria-hidden />
      )}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "pending" | "paid" | "waived" | "neutral";
}) {
  const dot: Record<typeof accent, string> = {
    pending: "bg-[#c9a24b]",
    paid: "bg-[#5c7a5f]",
    waived: "bg-[#a89f87]",
    neutral: "bg-[#1c2b22]",
  } as const;

  return (
    <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6] px-4 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot[accent]}`} />
        <p className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{label}</p>
      </div>
      <p className="font-mono text-lg text-[#1c2b22]">{value}</p>
    </div>
  );
}

function FeeTypesTable({ rows }: { rows: FeeType[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No fee types match your search." />;
  }

  return (
    <div className="overflow-scroll rounded-sm border border-[#c9a24b]/30 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
            {["Code", "Name", "Category", "Type", "Amount / Rate", "Status", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-serif text-[13px] font-normal tracking-wide text-[#1c2b22]/70"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id} className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]">
              <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{f.code}</td>
              <td className="px-4 py-3 text-[#1c2b22]">{f.name}</td>
              <td className="px-4 py-3 text-[#1c2b22]/70">{CATEGORY_LABEL[f.category]}</td>
              <td className="px-4 py-3 text-[#1c2b22]/70">
                {f.calculationType.charAt(0) + f.calculationType.slice(1).toLowerCase()}
              </td>
              <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]">{feeAmountLabel(f)}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                    f.isActive
                      ? "border-[#5c7a5f]/50 bg-[#dfe9dd] text-[#1c2b22]"
                      : "border-[#a89f87]/50 bg-[#e4e0d6] text-[#5c5646]"
                  }`}
                >
                  {f.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <a href={`#edit-${f.id}`} className="text-sm text-[#c9a24b] underline underline-offset-4 hover:text-[#a9843c]">
                  Edit
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargesTable({ rows }: { rows: FeeCharge[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No charges match your search." />;
  }

  return (
    <div className="overflow-hidden rounded-sm border border-[#c9a24b]/30 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
            {["Member", "Fee", "Amount", "Status", "Due", "Paid", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-serif text-[13px] font-normal tracking-wide text-[#1c2b22]/70"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]">
              <td className="px-4 py-3">
                <div className="text-[#1c2b22]">{c.memberName}</div>
                <div className="font-mono text-[12px] text-[#1c2b22]/50">{c.memberNumber}</div>
              </td>
              <td className="px-4 py-3 text-[#1c2b22]/70">{c.feeTypeName}</td>
              <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]">{KES.format(c.amount)}</td>
              <td className="px-4 py-3">
                <StatusPill status={c.status} />
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-[#1c2b22]/60">
                {c.dueDate ?? "—"}
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-[#1c2b22]/60">
                {c.paidDate ?? "—"}
              </td>
              <td className="px-4 py-3 text-right">
                {c.status === "PENDING" && (
                  <a href={`#waive-${c.id}`} className="text-sm text-[#c9a24b] underline underline-offset-4 hover:text-[#a9843c]">
                    Waive
                  </a>
                )}
                {c.status === "PAID" && (
                  <a href={`#reverse-${c.id}`} className="text-sm text-[#7a2e1c] underline underline-offset-4 hover:text-[#5c2114]">
                    Reverse
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-dashed border-[#c9a24b]/40 bg-[#eee7d6]/40 px-4 py-14 text-center">
      <p className="font-serif text-base text-[#1c2b22]/70">{message}</p>
    </div>
  );
}

function NewFeeTypeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/40 px-4">
      <div className="w-full max-w-lg rounded-sm border border-[#c9a24b]/40 bg-[#faf6ec] p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
              Fee Definitions
            </p>
            <h2 className="font-serif text-xl text-[#1c2b22]">New Fee Type</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#1c2b22]/50 hover:text-[#1c2b22]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code">
              <input className="input" placeholder="e.g. LOAN_PROCESSING" />
            </Field>
            <Field label="Name">
              <input className="input" placeholder="e.g. Loan Processing Fee" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className="input">
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Calculation">
              <select className="input">
                <option value="FLAT">Flat amount</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="TIERED">Tiered</option>
              </select>
            </Field>
          </div>
          <Field label="Amount / Rate">
            <input className="input" placeholder="e.g. 500 or 2.5%" />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-[#c9a24b]/40 px-4 py-2 text-sm text-[#1c2b22]/70 hover:bg-[#eee7d6]"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-sm border border-[#c9a24b] bg-[#1c2b22] px-4 py-2 text-sm text-[#faf6ec] hover:bg-[#1c2b22]/90"
            >
              Save Fee Type
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid rgba(201, 162, 75, 0.4);
          border-radius: 2px;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #1c2b22;
        }
        .input:focus {
          outline: none;
          border-color: #c9a24b;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">
        {label}
      </span>
      {children}
    </label>
  );
}