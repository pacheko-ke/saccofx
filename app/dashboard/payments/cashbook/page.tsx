"use client";

import { useEffect, useMemo, useState } from "react";

interface CashbookEntry {
  id: string;
  entryDate: string;
  voucherNumber: string;
  accountType: "cash" | "bank_kcb" | "bank_coop" | "mpesa_paybill";
  description: string;
  category: string;
  type: "debit" | "credit";
  amount: number;
  referenceNumber: string;
  performedBy: string;
}

const ACCOUNT_OPTIONS = [
  { value: "all", label: "All Accounts" },
  { value: "cash", label: "Petty Cash Office" },
  { value: "mpesa_paybill", label: "M-Pesa C2B Paybill" },
  { value: "bank_kcb", label: "KCB Main Account" },
  { value: "bank_coop", label: "Co-op Bank Operations" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Transactions" },
  { value: "debit", label: "Receipts (Debit / In)" },
  { value: "credit", label: "Payments (Credit / Out)" },
];

const PAGE_SIZE = 20;

export default function CashbookPage() {
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);

  // Modal State: null | "receipt" | "payment"
  const [activeModal, setActiveModal] = useState<"receipt" | "payment" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    accountType: "cash",
    category: "",
    amount: "",
    referenceNumber: "",
    description: "",
  });

  // Fetch full cashbook ledger on mount
  const fetchCashbook = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/cashbook");
      if (!res.ok) throw new Error("Failed to load cashbook entries");
      const data = await res.json();
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashbook();
  }, []);

  const openModal = (modalType: "receipt" | "payment") => {
    setFormData({
      accountType: "cash",
      category: modalType === "receipt" ? "Share Capital" : "Administrative Expense",
      amount: "",
      referenceNumber: "",
      description: "",
    });
    setActiveModal(modalType);
  };

  const closeModal = () => {
    if (!submitting) setActiveModal(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        type: activeModal === "receipt" ? "debit" : "credit",
        amount: parseFloat(formData.amount),
        entryDate: new Date().toISOString(),
      };

      const res = await fetch("/api/v1/cashbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to record entry");

      await fetchCashbook();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving transaction");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter entries based on search, account, and type
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return entries.filter((e) => {
      const matchesAccount = account === "all" || e.accountType === account;
      const matchesType = type === "all" || e.type === type;
      if (!matchesAccount || !matchesType) return false;

      if (!q) return true;

      return (
        e.voucherNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.referenceNumber.toLowerCase().includes(q) ||
        e.performedBy.toLowerCase().includes(q)
      );
    });
  }, [entries, search, account, type]);

  // Compute running totals and balance
  const { totalDebits, totalCredits, netBalance, entriesWithRunningBalance } =
    useMemo(() => {
      let running = 0;
      let debits = 0;
      let credits = 0;

      const withBalance = filtered.map((entry) => {
        if (entry.type === "debit") {
          debits += entry.amount;
          running += entry.amount;
        } else {
          credits += entry.amount;
          running -= entry.amount;
        }
        return { ...entry, runningBalance: running };
      });

      return {
        totalDebits: debits,
        totalCredits: credits,
        netBalance: debits - credits,
        entriesWithRunningBalance: withBalance,
      };
    }, [filtered]);

  useEffect(() => {
    setPage(1);
  }, [search, account, type]);

  const totalPages = Math.max(1, Math.ceil(entriesWithRunningBalance.length / PAGE_SIZE));
  const paginated = entriesWithRunningBalance.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(val);

  return (
    <div className="min-h-screen bg-[#eee7d6]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#1c2b22]">General Cashbook</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">
              Dual-entry financial register for cash, M-Pesa, and bank accounts.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openModal("receipt")}
              className="inline-flex items-center justify-center rounded-md border border-[#c9a24b]/50 bg-[#faf6ec] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
            >
              + Record Receipt (In)
            </button>
            <button
              onClick={() => openModal("payment")}
              className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
            >
              + Record Payment (Out)
            </button>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Total Receipts (Debit)
            </span>
            <div className="mt-1 font-serif text-xl font-semibold text-[#1c2b22]">
              {formatCurrency(totalDebits)}
            </div>
          </div>
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Total Payments (Credit)
            </span>
            <div className="mt-1 font-serif text-xl font-semibold text-[#8a2c2c]">
              {formatCurrency(totalCredits)}
            </div>
          </div>
          <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-[#4a5c50]">
              Closing Net Balance
            </span>
            <div
              className={`mt-1 font-serif text-xl font-semibold ${
                netBalance >= 0 ? "text-[#1c2b22]" : "text-[#8a2c2c]"
              }`}
            >
              {formatCurrency(netBalance)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search voucher, description, ref no, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          />
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {ACCOUNT_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">
            {error}
          </div>
        )}

        {/* Cashbook Ledger Table */}
        <div className="overflow-x-auto rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 text-left">
              <tr>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Date</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Voucher No.</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Description</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Ref / Txn No</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22] text-right">
                  Debit In (+)
                </th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22] text-right">
                  Credit Out (-)
                </th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22] text-right">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading cashbook entries...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9aa79f]">
                    No cashbook entries found
                  </td>
                </tr>
              ) : (
                paginated.map((e) => (
                  <tr key={e.id} className="hover:bg-[#eee7d6]/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#4a5c50]">
                      {new Date(e.entryDate).toLocaleDateString("en-KE")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1c2b22]">
                      {e.voucherNumber}
                    </td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      <div className="font-medium">{e.description}</div>
                      <div className="text-xs text-[#9aa79f]">
                        {e.category} ·{" "}
                        <span className="capitalize">{e.accountType.replace("_", " ")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">
                      {e.referenceNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-right text-[#1c2b22]">
                      {e.type === "debit" ? formatCurrency(e.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-right text-[#8a2c2c]">
                      {e.type === "credit" ? formatCurrency(e.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-right text-[#1c2b22]">
                      {formatCurrency(e.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#4a5c50]">
            {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} · Page {page} of{" "}
            {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[#c9a24b]/40 px-3 py-1 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[#c9a24b]/40 px-3 py-1 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-[#c9a24b]/40 bg-[#faf6ec] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#c9a24b]/20 pb-3">
              <h2 className="font-serif text-xl font-semibold text-[#1c2b22]">
                {activeModal === "receipt" ? "Record Cash Receipt (In)" : "Record Payment (Out)"}
              </h2>
              <button
                onClick={closeModal}
                className="text-[#9aa79f] hover:text-[#1c2b22]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium uppercase text-[#4a5c50] mb-1">
                  Target Account
                </label>
                <select
                  value={formData.accountType}
                  onChange={(e) =>
                    setFormData({ ...formData, accountType: e.target.value })
                  }
                  className="w-full rounded-md border border-[#c9a24b]/40 bg-[#eee7d6]/40 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                >
                  {ACCOUNT_OPTIONS.filter((a) => a.value !== "all").map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase text-[#4a5c50] mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    activeModal === "receipt"
                      ? "e.g. Loan Repayment, Share Capital"
                      : "e.g. Office Supplies, Sitting Allowance"
                  }
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full rounded-md border border-[#c9a24b]/40 bg-[#eee7d6]/40 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase text-[#4a5c50] mb-1">
                    Amount (KES)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full rounded-md border border-[#c9a24b]/40 bg-[#eee7d6]/40 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase text-[#4a5c50] mb-1">
                    Reference / Txn No.
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MPESA Ref, Cheque No"
                    value={formData.referenceNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, referenceNumber: e.target.value })
                    }
                    className="w-full rounded-md border border-[#c9a24b]/40 bg-[#eee7d6]/40 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase text-[#4a5c50] mb-1">
                  Description / Narration
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter details about this entry..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-[#c9a24b]/40 bg-[#eee7d6]/40 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none"
                />
              </div>

              <div className="mt-2 flex justify-end gap-3 border-t border-[#c9a24b]/20 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-md border border-[#c9a24b]/40 px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#eee7d6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}