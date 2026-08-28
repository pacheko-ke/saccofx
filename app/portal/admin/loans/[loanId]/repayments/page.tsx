"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

/* ────────────────────────────────────────────────────────────
   Types — mirror the Loan / LoanSchedule / LoanRepayment models
   ──────────────────────────────────────────────────────────── */

type InstallmentStatus = "UPCOMING" | "DUE" | "PARTIAL" | "PAID" | "OVERDUE";
type RepaymentMethod = "MPESA" | "COOP_IFT" | "PESALINK" | "CASH" | "BANK_TRANSFER";

interface LoanSummary {
    id: string;
    loanNumber: string;
    product_name: string;
    outstanding:any;
    first_name: string;
    last_name: string;
    loan_account_number:string,
    member_number:string,
    productName: string;
    principal: number;
    memberName:string;
    interestRate: number;
    disbursed_at: string;
    termMonths: number;
    outstandingBalance: number;
    arrearsAmount: number;
    daysInArrears: number;
    nextDueDate: string | null;
    nextDueAmount: number | null;
    status: "PERFORMING" | "WATCH" | "SUBSTANDARD" | "DOUBTFUL" | "LOSS";
}

interface ScheduleRow {
    id: string;
    installmentNo: number;
    dueDate: string;
    principalDue: number;
    interestDue: number;
    totalDue: number;
    principalPaid: number;
    interestPaid: number;
    totalPaid: number;
    balanceAfter: number;
    status: InstallmentStatus;
}

interface RepaymentRow {
    id: string;
    paidDate: string;
    amount: number;
    method: RepaymentMethod;
    reference: string;
    principalAllocated: number;
    interestAllocated: number;
    penaltyAllocated: number;
    postedBy: string;
}

/* ────────────────────────────────────────────────────────────
   Display helpers
   ──────────────────────────────────────────────────────────── */

const KES = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
});

const METHOD_LABEL: Record<RepaymentMethod, string> = {
    MPESA: "M-Pesa",
    COOP_IFT: "Co-op IFT",
    PESALINK: "PesaLink",
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
};

const INSTALLMENT_STYLE: Record<InstallmentStatus, string> = {
    UPCOMING: "bg-[#e4e0d6] text-[#5c5646] border-[#a89f87]/50",
    DUE: "bg-[#f3e6c4] text-[#7a5a12] border-[#c9a24b]/60",
    PARTIAL: "bg-[#f0dcc0] text-[#7a4a12] border-[#c9a24b]/60",
    PAID: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
    OVERDUE: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
};

const LOAN_STATUS_STYLE: Record<LoanSummary["status"], string> = {
    PERFORMING: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
    WATCH: "bg-[#f3e6c4] text-[#7a5a12] border-[#c9a24b]/60",
    SUBSTANDARD: "bg-[#f0dcc0] text-[#7a4a12] border-[#c9a24b]/60",
    DOUBTFUL: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
    LOSS: "bg-[#e3c9c2] text-[#5c1c0e] border-[#b8543a]/70",
};

function Pill({ label, className }: { label: string; className: string }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide font-sans ${className}`}
        >
            {label}
        </span>
    );
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

type Tab = "schedule" | "history";

export default function LoanRepaymentsPage() {
    const params = useParams();
    const loanId = params.loanId as string;

    const [loan, setLoan] = useState<LoanSummary | null>(null);
    const [outstanding, setOutsatnding] = useState(null);
    const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
    const [due,setDueDate] = useState()
    const [repayments, setRepayments] = useState<RepaymentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("schedule");
    const [showRecordModal, setShowRecordModal] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const [loanRes, scheduleRes, repayRes] = await Promise.all([
                    fetch(`/api/v1/loans/${loanId}`),
                    fetch(`/api/v1/loans/${loanId}/schedule`),
                    fetch(`/api/v1/loans/${loanId}/repayments`),
                ]);
              

                if (!loanRes.ok) {
                    throw new Error(`Loan fetch failed: ${loanRes.status} ${loanRes.statusText}`);
                }
                if (!scheduleRes.ok) {
                    throw new Error(`Schedule fetch failed: ${scheduleRes.status} ${scheduleRes.statusText}`);
                }
                if (!repayRes.ok) {
                    throw new Error(`Repayments fetch failed: ${repayRes.status} ${repayRes.statusText}`);
                }

                const loanData= await loanRes.json();
                const scheduleData = await scheduleRes.json();
                const repayData = await repayRes.json();

                console.log(repayData)

                if (!cancelled) {
                    setLoan(loanData.loan ?? loanData.loan);
                    setOutsatnding(loanData.outstanding.outstanding_balance);
                   setDueDate(scheduleData.loan_schedule.due_date?? scheduleData.loan_schedule.due_date)
                    // const outstandingBalance = data.outstanding.outstanding_balance;
                    // console.log(loanData.outstanding.outstanding_balance)
                    // setSchedule(scheduleData.schedule ?? scheduleData ?? []);
                    // setRepayments(repayData.repayments ?? repayData ?? []);
                }
            } catch (err) {
                console.error("Failed to load loan data:", err);
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load loan data");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (loanId) load();
        return () => {
            cancelled = true;
        };
    }, [loanId]);

    const totals = useMemo(() => {
        const totalScheduled = schedule.reduce((s, r) => s + r.totalDue, 0);
        const totalPaid = schedule.reduce((s, r) => s + r.totalPaid, 0);
        const percentPaid = totalScheduled > 0 ? Math.round((totalPaid / totalScheduled) * 100) : 0;
        return { totalScheduled, totalPaid, percentPaid };
    }, [schedule]);

    /* ── Loading state ── */
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#faf6ec] font-sans text-[#1c2b22]">
                <p className="text-sm text-[#1c2b22]/60">Loading loan…</p>
            </div>
        );
    }

    /* ── Error state ── */
    if (error || !loan) {
        return (
            <div className="min-h-screen bg-[#faf6ec] px-6 py-10 font-sans text-[#1c2b22]">
                <div className="mx-auto max-w-2xl rounded-sm border border-[#b8543a]/50 bg-[#efd9d4] px-5 py-4">
                    <p className="font-serif text-lg text-[#7a2e1c]">Couldn't load this loan</p>
                    <p className="mt-1 text-sm text-[#7a2e1c]/80">
                        {error ?? "No loan data returned."} (loan id: <code className="font-mono">{loanId}</code>)
                    </p>
                    <p className="mt-3 text-xs text-[#7a2e1c]/70">
                        Check the Network tab for the failing request, and confirm
                        <code className="mx-1 font-mono">/api/loans/{loanId}</code>,
                        <code className="mx-1 font-mono">/api/loans/{loanId}/schedule</code>, and
                        <code className="mx-1 font-mono">/api/loans/{loanId}/repayments</code>
                        all return 200 with JSON.
                    </p>
                </div>
            </div>
        );
    }

    /* ── Loaded state ── */
    return (
        <div className="min-h-screen bg-[#faf6ec] font-sans text-[#1c2b22]">
            <div className="mx-auto max-w-6xl px-6 py-10">
                {/* Header */}
                <header className="mb-6 border-b border-[#c9a24b]/40 pb-6">
                    <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
                        Loans &middot; Repayments
                    </p>
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div>
                            <h1 className="font-serif text-3xl text-[#1c2b22]">
                                {loan.first_name} {loan.last_name}
                                <span className="ml-3 align-middle font-mono text-base text-[#1c2b22]/45">
                                    {loan.loan_account_number}
                                </span>
                            </h1>
                            <p className="mt-1 text-sm text-[#1c2b22]/60">
                                {loan.product_name} &middot; {loan.member_number} &middot; Disbursed {loan.disbursed_at}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Pill label={loan.status} className={LOAN_STATUS_STYLE[loan.status]} />
                            <button
                                onClick={() => setShowRecordModal(true)}
                                className="inline-flex items-center justify-center rounded-sm border border-[#c9a24b] bg-[#1c2b22] px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition hover:bg-[#1c2b22]/90"
                            >
                                + Record Repayment
                            </button>
                        </div>
                    </div>
                </header>

                {/* Summary cards */}
                <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <SummaryCard label="Outstanding Balance" value={KES.format(outstanding??0)} accent="neutral" />
                    
                    <SummaryCard
                        label="Arrears"
                        value={loan.arrearsAmount > 0 ? KES.format(loan.arrearsAmount) : "None"}
                        sub={loan.daysInArrears > 0 ? `${loan.daysInArrears} days` : undefined}
                        accent={loan.arrearsAmount > 0 ? "overdue" : "paid"}
                    />
                    <SummaryCard
                        label="Next Due"
                        value={loan.nextDueAmount != null ? KES.format(loan.nextDueAmount) : "—"}
                        sub={due}
                        accent="due"
                    />
                    <SummaryCard label="Repaid to Date" value={`${totals.percentPaid}%`} sub={KES.format(totals.totalPaid)} accent="paid" />
                </div>

                {/* Progress bar */}
                <div className="mb-8">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#eee7d6]">
                        <div className="h-full bg-[#c9a24b] transition-all" style={{ width: `${totals.percentPaid}%` }} />
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex items-center gap-1 border-b border-[#c9a24b]/30">
                    <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>
                        Repayment Schedule
                    </TabButton>
                    <TabButton active={tab === "history"} onClick={() => setTab("history")}>
                        Repayment History
                    </TabButton>
                </div>

                {/* Content */}
                {tab === "schedule" ? <ScheduleTable rows={schedule} /> : <HistoryTable rows={repayments} />}
            </div>

            {showRecordModal && (
                <RecordRepaymentModal loan={loan} schedule={schedule} onClose={() => setShowRecordModal(false)} />
            )}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`relative px-4 py-2.5 text-sm font-medium transition ${active ? "text-[#1c2b22]" : "text-[#1c2b22]/50 hover:text-[#1c2b22]/80"
                }`}
        >
            {children}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#c9a24b]" aria-hidden />}
        </button>
    );
}

function SummaryCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: string;
    sub?: string;
    accent: "neutral" | "paid" | "due" | "overdue";
}) {
    const dot: Record<typeof accent, string> = {
        neutral: "bg-[#1c2b22]",
        paid: "bg-[#5c7a5f]",
        due: "bg-[#c9a24b]",
        overdue: "bg-[#b8543a]",
    } as const;

    return (
        <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6] px-4 py-4">
            <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${dot[accent]}`} />
                <p className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{label}</p>
            </div>
            <p className="font-mono text-lg text-[#1c2b22]">{value}</p>
            {sub && <p className="mt-0.5 font-mono text-[11px] text-[#1c2b22]/45">{sub}</p>}
        </div>
    );
}

function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
    if (rows.length === 0) return <EmptyState message="No schedule generated for this loan yet." />;

    return (
        <div className="overflow-x-auto rounded-sm border border-[#c9a24b]/30 bg-white">
            <table className="w-full min-w-[820px] text-sm">
                <thead>
                    <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
                        {["#", "Due Date", "Principal Due", "Interest Due", "Total Due", "Paid", "Balance After", "Status"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left font-serif text-[13px] font-normal tracking-wide text-[#1c2b22]/70">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]">
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/60">{r.installmentNo}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{r.dueDate}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]">{KES.format(r.principalDue)}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]">{KES.format(r.interestDue)}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]">{KES.format(r.totalDue)}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{KES.format(r.totalPaid)}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{KES.format(r.balanceAfter)}</td>
                            <td className="px-4 py-3">
                                <Pill label={r.status} className={INSTALLMENT_STYLE[r.status]} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function HistoryTable({ rows }: { rows: RepaymentRow[] }) {
    if (rows.length === 0) return <EmptyState message="No repayments recorded yet." />;

    return (
        <div className="overflow-x-auto rounded-sm border border-[#c9a24b]/30 bg-white">
            <table className="w-full min-w-[820px] text-sm">
                <thead>
                    <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
                        {["Date", "Amount", "Method", "Reference", "Principal", "Interest", "Penalty", "Posted By"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left font-serif text-[13px] font-normal tracking-wide text-[#1c2b22]/70">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]">
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{r.paidDate}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]">{KES.format(r.amount)}</td>
                            <td className="px-4 py-3 text-[#1c2b22]/70">{METHOD_LABEL[r.method]}</td>
                            <td className="px-4 py-3 font-mono text-[12px] text-[#1c2b22]/50">{r.reference}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{KES.format(r.principalAllocated)}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">{KES.format(r.interestAllocated)}</td>
                            <td className="px-4 py-3 font-mono text-[13px] text-[#1c2b22]/70">
                                {r.penaltyAllocated > 0 ? KES.format(r.penaltyAllocated) : "—"}
                            </td>
                            <td className="px-4 py-3 text-[#1c2b22]/60">{r.postedBy}</td>
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

/* ────────────────────────────────────────────────────────────
   Record Repayment modal
   ──────────────────────────────────────────────────────────── */

function computeFifoAllocation(amount: number, schedule: ScheduleRow[]) {
    const outstandingRows = schedule.filter((r) => r.status !== "PAID").sort((a, b) => a.installmentNo - b.installmentNo);

    let remaining = amount;
    const allocations: { installmentNo: number; dueDate: string; applied: number; remainingOnRow: number }[] = [];

    for (const row of outstandingRows) {
        if (remaining <= 0) break;
        const rowOutstanding = row.totalDue - row.totalPaid;
        const applied = Math.min(remaining, rowOutstanding);
        if (applied > 0) {
            allocations.push({ installmentNo: row.installmentNo, dueDate: row.dueDate, applied, remainingOnRow: rowOutstanding - applied });
            remaining -= applied;
        }
    }

    return { allocations, unallocated: remaining };
}

function RecordRepaymentModal({ loan, schedule, onClose }: { loan: LoanSummary; schedule: ScheduleRow[]; onClose: () => void }) {
    const [amount, setAmount] = useState<string>("");
    const [method, setMethod] = useState<RepaymentMethod>("MPESA");
    const [reference, setReference] = useState("");
    const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));

    const parsedAmount = Number(amount) || 0;
    const preview = useMemo(() => computeFifoAllocation(parsedAmount, schedule), [parsedAmount, schedule]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/40 px-4 py-8 overflow-y-auto">
            <div className="w-full max-w-xl rounded-sm border border-[#c9a24b]/40 bg-[#faf6ec] p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between">
                    <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
                            {loan.loanNumber} &middot; {loan.memberName}
                        </p>
                        <h2 className="font-serif text-xl text-[#1c2b22]">Record Repayment</h2>
                    </div>
                    <button onClick={onClose} className="text-[#1c2b22]/50 hover:text-[#1c2b22]" aria-label="Close">
                        ✕
                    </button>
                </div>

                <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Amount (KES)">
                            <input
                                className="input font-mono"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </Field>
                        <Field label="Date Paid">
                            <input type="date" className="input" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Method">
                            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as RepaymentMethod)}>
                                {Object.entries(METHOD_LABEL).map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Reference">
                            <input
                                className="input font-mono"
                                placeholder="e.g. M-Pesa code"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6]/50 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">FIFO Allocation Preview</p>
                        {parsedAmount <= 0 ? (
                            <p className="text-sm text-[#1c2b22]/50">Enter an amount to preview how it will be applied.</p>
                        ) : preview.allocations.length === 0 ? (
                            <p className="text-sm text-[#1c2b22]/50">No outstanding installments to apply this to.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {preview.allocations.map((a) => (
                                    <div key={a.installmentNo} className="flex items-center justify-between text-sm">
                                        <span className="text-[#1c2b22]/70">
                                            Installment #{a.installmentNo}{" "}
                                            <span className="font-mono text-[11px] text-[#1c2b22]/40">({a.dueDate})</span>
                                        </span>
                                        <span className="font-mono text-[#1c2b22]">{KES.format(a.applied)}</span>
                                    </div>
                                ))}
                                {preview.unallocated > 0 && (
                                    <div className="flex items-center justify-between border-t border-[#c9a24b]/30 pt-1.5 text-sm">
                                        <span className="text-[#7a5a12]">Advance / unallocated</span>
                                        <span className="font-mono text-[#7a5a12]">{KES.format(preview.unallocated)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

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
                            disabled={parsedAmount <= 0}
                            className="rounded-sm border border-[#c9a24b] bg-[#1c2b22] px-4 py-2 text-sm text-[#faf6ec] hover:bg-[#1c2b22]/90 disabled:opacity-40"
                        >
                            Post Repayment
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
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">{label}</span>
            {children}
        </label>
    );
}