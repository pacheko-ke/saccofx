"use client";

import { useEffect, useRef, useState } from "react";

interface Account {
  accountId: string;
  accountNo: string;
  productName: string;
  balance: number;
}

interface MemberResult {
  id: string;
  memberNo: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  accounts: Account[];
}

interface DepositRecord {
  id: string;
  reference: string | null;
  amount: number;
  channel: string;
  narration: string | null;
  balanceAfter: number;
  createdAt: string;
  accountNo: string;
  memberNo: string;
  firstName: string;
  lastName: string;
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

function formatKES(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function TellerDepositsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [todayDeposits, setTodayDeposits] = useState<DepositRecord[]>([]);
  const [lastReceipt, setLastReceipt] = useState<DepositRecord | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced member search — server-side, since the full member base
  // is too large to fetch and filter client-side (unlike smaller lists).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.members ?? []);
      } catch (err) {
        console.error("Member search failed", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function loadTodayDeposits() {
    try {
      const res = await fetch("/api/teller/deposits");
      const data = await res.json();
      setTodayDeposits(data.deposits ?? []);
    } catch (err) {
      console.error("Failed to load today's deposits", err);
    }
  }

  useEffect(() => {
    loadTodayDeposits();
  }, []);

  function pickMember(member: MemberResult) {
    setSelectedMember(member);
    setSelectedAccount(member.accounts[0] ?? null);
    setResults([]);
    setQuery(`${member.firstName} ${member.lastName} (${member.memberNo})`);
  }

  function resetForm() {
    setSelectedMember(null);
    setSelectedAccount(null);
    setQuery("");
    setAmount("");
    setMethod("cash");
    setReference("");
    setNarration("");
    setFormError(null);
  }

  async function submitDeposit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedAccount) {
      setFormError("Select a member account first.");
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setFormError("Enter a valid deposit amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/teller/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount.accountId,
          amount: numericAmount,
          method,
          reference: reference || undefined,
          narration: narration || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "Failed to post deposit.");
        return;
      }

      const receipt: DepositRecord = {
        id: data.id,
        reference: data.reference,
        amount: data.amount,
        channel: data.method,
        narration: narration || null,
        balanceAfter: data.balanceAfter,
        createdAt: data.createdAt,
        accountNo: selectedAccount.accountNo,
        memberNo: selectedMember!.memberNo,
        firstName: selectedMember!.firstName,
        lastName: selectedMember!.lastName,
      };

      setLastReceipt(receipt);
      await loadTodayDeposits();
      resetForm();
    } catch (err) {
      console.error("Deposit submission failed", err);
      setFormError("Network error — deposit was not posted.");
    } finally {
      setSubmitting(false);
    }
  }

  const todayTotal = todayDeposits.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="min-h-screen bg-[#faf6ec]">
      <div className="print:hidden">
        <header className="border-b border-[#c9a24b]/30 bg-[#1c2b22] px-6 py-5">
          <h1 className="font-serif text-2xl text-[#faf6ec]">Teller Deposits</h1>
          <p className="mt-1 text-sm text-[#eee7d6]/80">
            Post member savings deposits and print receipts
          </p>
        </header>

        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Deposit form */}
          <div className="rounded-lg border border-[#1c2b22]/10 bg-white p-5">
            <h2 className="mb-4 font-serif text-lg text-[#1c2b22]">New Deposit</h2>

            <div className="relative mb-4">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
                Member
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedMember(null);
                  setSelectedAccount(null);
                }}
                placeholder="Search by name, member no, or phone..."
                className="w-full rounded-md border border-[#1c2b22]/20 px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              />
              {searching && (
                <p className="mt-1 text-xs text-[#1c2b22]/50">Searching...</p>
              )}
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[#1c2b22]/10 bg-white shadow-lg">
                  {results.map((m) => (
                    <li
                      key={m.id}
                      onClick={() => pickMember(m)}
                      className="cursor-pointer border-b border-[#1c2b22]/5 px-3 py-2 text-sm last:border-0 hover:bg-[#faf6ec]"
                    >
                      <div className="font-medium text-[#1c2b22]">
                        {m.firstName} {m.lastName}
                      </div>
                      <div className="text-xs text-[#1c2b22]/60">
                        {m.memberNo} · {m.phone ?? "no phone"} ·{" "}
                        {m.accounts.length} account{m.accounts.length === 1 ? "" : "s"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedMember && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
                  Account
                </label>
                {selectedMember.accounts.length === 0 ? (
                  <p className="text-sm text-red-700">
                    This member has no active savings accounts.
                  </p>
                ) : (
                  <select
                    value={selectedAccount?.accountId ?? ""}
                    onChange={(e) =>
                      setSelectedAccount(
                        selectedMember.accounts.find(
                          (a) => a.accountId === e.target.value
                        ) ?? null
                      )
                    }
                    className="w-full rounded-md border border-[#1c2b22]/20 px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
                  >
                    {selectedMember.accounts.map((a) => (
                      <option key={a.accountId} value={a.accountId}>
                        {a.accountNo} — {a.productName} (Bal: {formatKES(a.balance)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <form onSubmit={submitDeposit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
                  Amount (KES)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-[#1c2b22]/20 px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
                  Method
                </label>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        method === m.value
                          ? "border-[#c9a24b] bg-[#c9a24b]/15 text-[#1c2b22]"
                          : "border-[#1c2b22]/20 text-[#1c2b22]/70 hover:bg-[#faf6ec]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {method !== "cash" && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
                    Reference No.{" "}
                    {method === "cheque" ? "(cheque no.)" : "(transaction code)"}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full rounded-md border border-[#1c2b22]/20 px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/60">
                  Narration (optional)
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Monthly savings top-up"
                  className="w-full rounded-md border border-[#1c2b22]/20 px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
                />
              </div>

              {formError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedAccount}
                className="w-full rounded-md bg-[#c9a24b] px-4 py-2.5 text-sm font-medium text-[#1c2b22] hover:bg-[#b8913f] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Posting..." : "Post Deposit"}
              </button>
            </form>
          </div>

          {/* Today's deposits + last receipt */}
          <div className="space-y-6">
            {lastReceipt && (
              <div className="rounded-lg border border-[#c9a24b]/40 bg-[#1c2b22] p-4 text-[#faf6ec]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-serif text-sm">Deposit Posted</span>
                  <button
                    onClick={() => window.print()}
                    className="rounded-md bg-[#c9a24b] px-3 py-1 text-xs font-medium text-[#1c2b22] hover:bg-[#b8913f]"
                  >
                    Print Receipt
                  </button>
                </div>
                <p className="text-lg font-semibold">{formatKES(lastReceipt.amount)}</p>
                <p className="text-xs text-[#eee7d6]/70">
                  {lastReceipt.firstName} {lastReceipt.lastName} · {lastReceipt.accountNo}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-[#1c2b22]/10 bg-white">
              <div className="flex items-center justify-between border-b border-[#1c2b22]/10 px-4 py-3">
                <h2 className="font-serif text-lg text-[#1c2b22]">
                  Today&apos;s Deposits
                </h2>
                <span className="text-sm font-medium text-[#1c2b22]/70">
                  Total: {formatKES(todayTotal)}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[#eee7d6] text-left text-[#1c2b22]">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {todayDeposits.map((d) => (
                    <tr key={d.id} className="border-t border-[#1c2b22]/5">
                      <td className="px-3 py-2 text-[#1c2b22]/70">
                        {new Date(d.createdAt).toLocaleTimeString("en-KE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 text-[#1c2b22]">
                        {d.firstName} {d.lastName}
                        <div className="text-xs text-[#1c2b22]/50">{d.accountNo}</div>
                      </td>
                      <td className="px-3 py-2 capitalize text-[#1c2b22]/70">
                        {d.channel.replace("_", " ")}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#1c2b22]">
                        {formatKES(d.amount)}
                      </td>
                    </tr>
                  ))}
                  {todayDeposits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[#1c2b22]/50">
                        No deposits posted yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only receipt */}
      {lastReceipt && (
        <div className="hidden print:block">
          <div className="receipt">
            <div className="receipt-header">
              <div className="receipt-org">SACCOFX PRO</div>
              <div className="receipt-sub">Deposit Receipt</div>
            </div>
            <div className="receipt-row">
              <span>Date</span>
              <span>
                {new Date(lastReceipt.createdAt).toLocaleString("en-KE")}
              </span>
            </div>
            <div className="receipt-row">
              <span>Member</span>
              <span>
                {lastReceipt.firstName} {lastReceipt.lastName}
              </span>
            </div>
            <div className="receipt-row">
              <span>Member No.</span>
              <span>{lastReceipt.memberNo}</span>
            </div>
            <div className="receipt-row">
              <span>Account</span>
              <span>{lastReceipt.accountNo}</span>
            </div>
            <div className="receipt-row">
              <span>Method</span>
              <span className="capitalize">{lastReceipt.channel.replace("_", " ")}</span>
            </div>
            {lastReceipt.reference && (
              <div className="receipt-row">
                <span>Reference</span>
                <span>{lastReceipt.reference}</span>
              </div>
            )}
            <div className="receipt-divider" />
            <div className="receipt-row receipt-total">
              <span>Amount Deposited</span>
              <span>{formatKES(lastReceipt.amount)}</span>
            </div>
            <div className="receipt-row">
              <span>Balance After</span>
              <span>{formatKES(lastReceipt.balanceAfter)}</span>
            </div>
            <div className="receipt-footer">Thank you. Keep this receipt.</div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          body {
            background: white !important;
          }
          .receipt {
            width: 72mm;
            font-family: "Courier New", monospace;
            color: #1c2b22;
            font-size: 9pt;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 0.4mm dashed #1c2b22;
            padding-bottom: 2mm;
            margin-bottom: 2mm;
          }
          .receipt-org {
            font-weight: bold;
            font-size: 11pt;
            letter-spacing: 0.5pt;
          }
          .receipt-sub {
            font-size: 8pt;
            color: #c9a24b;
          }
          .receipt-row {
            display: flex;
            justify-content: space-between;
            padding: 0.6mm 0;
          }
          .receipt-divider {
            border-top: 0.4mm dashed #1c2b22;
            margin: 2mm 0;
          }
          .receipt-total {
            font-weight: bold;
            font-size: 10pt;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 3mm;
            font-size: 7.5pt;
            color: #1c2b22;
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}