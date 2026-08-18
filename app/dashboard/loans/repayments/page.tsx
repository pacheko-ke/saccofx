"use client";

// app/dashboard/loans/repayments/page.tsx
//
// Loan repayment entry page.
// Visual identity: passbook / ledger — ink-green, cream/parchment, brass gold,
// serif headings — matching the rest of SaccoFX Pro.
//
// Flow: search a loan -> review its ledger stub -> key in a payment ->
// watch the FIFO allocation (penalty -> interest -> principal) update live ->
// post it and get a receipt number.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getLoanRepaymentContext,
  postLoanRepayment,
  searchLoansForRepayment,
} from "@/app/actions/loan-repayment";
import { allocateRepayment } from "@/app/lib/loan-repayment/allocate";
import type {
  LoanRepaymentContext,
  LoanSearchResult,
  ParBucket,
  PaymentMethod,
} from "@/types/loan-repayment";

const PAR_LABEL: Record<ParBucket, string> = {
  CURRENT: "Current",
  PAR_1_30: "1–30 days",
  PAR_31_60: "31–60 days",
  PAR_61_90: "61–90 days",
  PAR_91_180: "91–180 days",
  PAR_180_PLUS: "180+ days",
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "MPESA", label: "M-Pesa" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
];

export default function LoanRepaymentPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LoanSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [loan, setLoan] = useState<LoanRepaymentContext | null>(null);
  const [loadingLoan, setLoadingLoan] = useState(false);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("MPESA");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [posting, startPosting] = useTransition();
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // debounce search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchLoansForRepayment(query);
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function selectLoan(loanId: string) {
    setLoadingLoan(true);
    setError(null);
    setReceipt(null);
    try {
      const ctx = await getLoanRepaymentContext(loanId);
      setLoan(ctx);
      setResults([]);
      setQuery("");
      setAmount("");
      setReference("");
      setNotes("");
    } catch (e) {
      setError("Could not load that loan. Try searching again.");
    } finally {
      setLoadingLoan(false);
    }
  }

  const amountNum = Number(amount) || 0;

  const allocation = useMemo(() => {
    if (!loan || amountNum <= 0) return null;
    return allocateRepayment(amountNum, loan);
  }, [loan, amountNum]);

  function reset() {
    setLoan(null);
    setAmount("");
    setReference("");
    setNotes("");
    setReceipt(null);
    setError(null);
  }

  function submit() {
    if (!loan) return;
    setError(null);
    startPosting(async () => {
      const res = await postLoanRepayment({
        loanId: loan.loanId,
        amount: amountNum,
        method,
        reference,
        paidAt: new Date().toISOString(),
        notes: notes || undefined,
      });
      if (res.success) {
        setReceipt(res.receiptNumber ?? "POSTED");
      } else {
        setError(res.error ?? "Something went wrong posting this repayment.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#eee7d6] py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-xs tracking-[0.2em] uppercase text-[#1c2b22]/60 font-medium">
            saccofx pro · Loans
          </p>
          <h1 className="font-serif text-3xl text-[#1c2b22] mt-1">
            Record a Loan Repayment
          </h1>
        </header>

        {receipt ? (
          <ReceiptCard
            receiptNumber={receipt}
            loan={loan!}
            amount={amountNum}
            method={method}
            onNew={reset}
          />
        ) : (
          <>
            {!loan && (
              <SearchPanel
                query={query}
                setQuery={setQuery}
                results={results}
                searching={searching}
                onSelect={selectLoan}
                loading={loadingLoan}
              />
            )}

            {loan && (
              <div className="space-y-5">
                <LoanStub loan={loan} onChangeLoan={reset} />

                <PaymentForm
                  amount={amount}
                  setAmount={setAmount}
                  method={method}
                  setMethod={setMethod}
                  reference={reference}
                  setReference={setReference}
                  notes={notes}
                  setNotes={setNotes}
                />

                {allocation && (
                  <AllocationLedger
                    allocation={allocation}
                    loan={loan}
                    amount={amountNum}
                  />
                )}

                {error && (
                  <div className="rounded-sm border border-[#a13d2c]/40 bg-[#a13d2c]/5 px-4 py-3 text-sm text-[#a13d2c]">
                    {error}
                  </div>
                )}

                <button
                  disabled={
                    posting ||
                    amountNum <= 0 ||
                    (method !== "CASH" && !reference.trim())
                  }
                  onClick={submit}
                  className="w-full rounded-sm bg-[#1c2b22] text-[#faf6ec] font-serif text-lg py-3 tracking-wide
                             disabled:opacity-40 disabled:cursor-not-allowed
                             hover:bg-[#1c2b22]/90 transition-colors"
                >
                  {posting ? "Posting…" : `Post Repayment${amountNum > 0 ? ` · KES ${fmt(amountNum)}` : ""}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search panel
// ---------------------------------------------------------------------------
function SearchPanel({
  query,
  setQuery,
  results,
  searching,
  onSelect,
  loading,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: LoanSearchResult[];
  searching: boolean;
  onSelect: (loanId: string) => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-sm bg-[#faf6ec] border border-[#1c2b22]/15 shadow-sm p-5">
      <label className="block text-xs uppercase tracking-widest text-[#1c2b22]/60 mb-2">
        Find loan by number, member number, or name
      </label>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. LN-00214 or Wanjiru Kamau"
        className="w-full rounded-sm border border-[#1c2b22]/25 bg-white px-3 py-2.5
                   font-serif text-lg text-[#1c2b22] placeholder:text-[#1c2b22]/30
                   focus:outline-none focus:ring-2 focus:ring-[#c9a24b]"
      />

      {searching && (
        <p className="mt-3 text-sm text-[#1c2b22]/50 italic">Searching the ledger…</p>
      )}

      {!searching && results.length > 0 && (
        <ul className="mt-4 divide-y divide-[#1c2b22]/10 border-t border-[#1c2b22]/10">
          {results.map((r) => (
            <li key={r.loanId}>
              <button
                onClick={() => onSelect(r.loanId)}
                disabled={loading}
                className="w-full text-left py-3 flex items-center justify-between gap-4 hover:bg-[#c9a24b]/10 px-2 -mx-2 rounded-sm transition-colors"
              >
                <div>
                  <p className="font-serif text-[#1c2b22] text-base">
                    {r.memberName}{" "}
                    <span className="text-[#1c2b22]/50 text-sm">· {r.memberNumber}</span>
                  </p>
                  <p className="text-xs text-[#1c2b22]/60 mt-0.5">
                    {r.loanNumber} · {r.productName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-serif tabular-nums text-[#1c2b22]">
                    KES {fmt(r.outstandingBalance)}
                  </p>
                  <ParPill bucket={r.parBucket} days={r.daysInArrears} compact />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-4 text-sm text-[#1c2b22]/50">
          No active loans match “{query}”.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loan stub — reads like the top of a passbook entry
// ---------------------------------------------------------------------------
function LoanStub({
  loan,
  onChangeLoan,
}: {
  loan: LoanRepaymentContext;
  onChangeLoan: () => void;
}) {
  return (
    <div className="rounded-sm bg-[#faf6ec] border border-[#1c2b22]/15 shadow-sm p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#c9a24b]" />
      <div className="flex items-start justify-between">
        <div>
          <p className="font-serif text-xl text-[#1c2b22]">{loan.memberName}</p>
          <p className="text-sm text-[#1c2b22]/60 mt-0.5">
            {loan.memberNumber} · {loan.loanNumber} · {loan.productName}
          </p>
        </div>
        <button
          onClick={onChangeLoan}
          className="text-xs uppercase tracking-widest text-[#1c2b22]/50 hover:text-[#1c2b22] underline underline-offset-4"
        >
          Change
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-dashed border-[#1c2b22]/20">
        <Stat label="Outstanding" value={`KES ${fmt(loan.totalOutstanding)}`} />
        <Stat
          label="Next due"
          value={loan.nextDueDate ? formatDate(loan.nextDueDate) : "—"}
        />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#1c2b22]/50 mb-1">
            Status
          </p>
          <ParPill bucket={loan.parBucket} days={loan.daysInArrears} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[#1c2b22]/50 mb-1">
        {label}
      </p>
      <p className="font-serif tabular-nums text-[#1c2b22]">{value}</p>
    </div>
  );
}

// PAR pill — styled like a rubber ink stamp for anything past due
function ParPill({
  bucket,
  days,
  compact = false,
}: {
  bucket: ParBucket;
  days: number;
  compact?: boolean;
}) {
  const isCurrent = bucket === "CURRENT";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-[3px] border font-serif italic",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        isCurrent
          ? "border-[#1c2b22]/30 text-[#1c2b22]/70"
          : "border-[#a13d2c]/60 text-[#a13d2c] -rotate-1",
      ].join(" ")}
    >
      {isCurrent ? "Current" : `PAR ${PAR_LABEL[bucket]}`}
      {!isCurrent && !compact && (
        <span className="not-italic text-[#a13d2c]/70">· {days}d</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Payment form
// ---------------------------------------------------------------------------
function PaymentForm({
  amount,
  setAmount,
  method,
  setMethod,
  reference,
  setReference,
  notes,
  setNotes,
}: {
  amount: string;
  setAmount: (v: string) => void;
  method: PaymentMethod;
  setMethod: (v: PaymentMethod) => void;
  reference: string;
  setReference: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  return (
    <div className="rounded-sm bg-[#faf6ec] border border-[#1c2b22]/15 shadow-sm p-5 space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-widest text-[#1c2b22]/60 mb-2">
          Amount received
        </label>
        <div className="flex items-center rounded-sm border border-[#1c2b22]/25 bg-white focus-within:ring-2 focus-within:ring-[#c9a24b]">
          <span className="pl-3 pr-1 font-serif text-[#1c2b22]/50">KES</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="w-full bg-transparent py-2.5 pr-3 font-serif text-2xl tabular-nums text-[#1c2b22] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-[#1c2b22]/60 mb-2">
          Payment method
        </label>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={[
                "rounded-sm border py-2 text-sm font-medium transition-colors",
                method === m.value
                  ? "border-[#1c2b22] bg-[#1c2b22] text-[#faf6ec]"
                  : "border-[#1c2b22]/25 text-[#1c2b22]/70 hover:border-[#1c2b22]/50",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-[#1c2b22]/60 mb-2">
          {method === "MPESA" && "M-Pesa transaction code"}
          {method === "CHEQUE" && "Cheque number"}
          {method === "CASH" && "Reference (optional)"}
        </label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={method === "MPESA" ? "e.g. QFH7X8K2LM" : method === "CHEQUE" ? "e.g. 000482" : "Teller note"}
          className="w-full rounded-sm border border-[#1c2b22]/25 bg-white px-3 py-2 text-[#1c2b22]
                     focus:outline-none focus:ring-2 focus:ring-[#c9a24b]"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-[#1c2b22]/60 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-sm border border-[#1c2b22]/25 bg-white px-3 py-2 text-[#1c2b22] text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#c9a24b] resize-none"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Allocation ledger — the FIFO preview, penalty -> interest -> principal
// ---------------------------------------------------------------------------
function AllocationLedger({
  allocation,
  loan,
  amount,
}: {
  allocation: ReturnType<typeof allocateRepayment>;
  loan: LoanRepaymentContext;
  amount: number;
}) {
  return (
    <div className="rounded-sm bg-[#faf6ec] border border-[#1c2b22]/15 shadow-sm p-5">
      <p className="text-xs uppercase tracking-widest text-[#1c2b22]/60 mb-3">
        How this payment will be applied
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-[#1c2b22]/50 border-b border-[#1c2b22]/15">
            <th className="pb-2 font-medium">Bucket</th>
            <th className="pb-2 font-medium text-right">Due</th>
            <th className="pb-2 font-medium text-right">Applied</th>
            <th className="pb-2 font-medium text-right">Remaining</th>
          </tr>
        </thead>
        <tbody className="font-serif tabular-nums text-[#1c2b22]">
          {allocation.lines.map((line) => (
            <tr key={line.bucket} className="border-b border-dashed border-[#1c2b22]/10">
              <td className="py-2">{line.label}</td>
              <td className="py-2 text-right text-[#1c2b22]/60">{fmt(line.due)}</td>
              <td className="py-2 text-right">
                {line.applied > 0 ? fmt(line.applied) : "—"}
              </td>
              <td className="py-2 text-right">
                {line.remainingAfter > 0 ? (
                  fmt(line.remainingAfter)
                ) : (
                  <span className="text-[#1c2b22]/40">cleared</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#c9a24b]">
        <span className="text-xs uppercase tracking-widest text-[#1c2b22]/60">
          {allocation.fullySettled ? "Loan fully settled" : "Total applied"}
        </span>
        <span className="font-serif text-lg text-[#1c2b22]">
          KES {fmt(allocation.totalApplied)}
        </span>
      </div>

      {allocation.overpayment > 0 && (
        <p className="mt-2 text-xs text-[#c9a24b]">
          KES {fmt(allocation.overpayment)} exceeds the outstanding balance and will be
          held as a credit on this loan.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------
function ReceiptCard({
  receiptNumber,
  loan,
  amount,
  method,
  onNew,
}: {
  receiptNumber: string;
  loan: LoanRepaymentContext;
  amount: number;
  method: PaymentMethod;
  onNew: () => void;
}) {
  return (
    <div className="rounded-sm bg-[#faf6ec] border-2 border-[#1c2b22] shadow-sm p-8 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-[#1c2b22]/50 mb-3">
        Repayment Posted
      </p>
      <p className="font-serif text-4xl text-[#1c2b22]">KES {fmt(amount)}</p>
      <p className="text-sm text-[#1c2b22]/60 mt-2">
        {loan.memberName} · {loan.loanNumber}
      </p>
      <p className="mt-4 inline-block border border-[#c9a24b] text-[#c9a24b] px-3 py-1 rounded-sm text-sm tracking-widest">
        Receipt {receiptNumber}
      </p>
      <p className="text-xs text-[#1c2b22]/50 mt-1">
        via {method === "MPESA" ? "M-Pesa" : method === "CASH" ? "Cash" : "Cheque"}
      </p>

      <div className="flex gap-3 justify-center mt-6">
        <button
          onClick={onNew}
          className="rounded-sm bg-[#1c2b22] text-[#faf6ec] px-5 py-2.5 font-serif hover:bg-[#1c2b22]/90"
        >
          Record another repayment
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function fmt(n: number): string {
  return n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}