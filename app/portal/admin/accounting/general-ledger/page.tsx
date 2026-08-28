"use client";

import { useEffect, useMemo, useState } from "react";

interface Account {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface LedgerEntry {
  line_id: string;
  entry_number: string;
  entry_date: string;
  reference: string;
  entry_description: string;
  line_description: string;
  debit_amount: string;
  credit_amount: string;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  running_balance: number | null;
}

interface Summary {
  totalDebits: number;
  totalCredits: number;
  net: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const KES = (n: number) => `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalDebits: 0, totalCredits: 0, net: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, totalCount: 0, totalPages: 1 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Load the account list once, for the filter dropdown.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/chart-of-accounts");
        if (!res.ok) return;
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      } catch {
        // Non-fatal: the ledger still works without the dropdown populated.
      }
    })();
  }, []);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [accountId, dateFrom, dateTo, search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (accountId) params.set("accountId", accountId);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (search) params.set("search", search);
        params.set("page", String(page));

        const res = await fetch(`/api/v1/general-ledger?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load general ledger");
        const data = await res.json();

        setEntries(data.entries ?? []);
        setSummary(data.summary ?? { totalDebits: 0, totalCredits: 0, net: 0 });
        setPagination(data.pagination ?? { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId, dateFrom, dateTo, search, page]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.gl_account_id === accountId),
    [accounts, accountId]
  );

  function clearFilters() {
    setAccountId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  return (
    <div className="min-h-screen bg-[#eee7d6] pt-4">
      <div className="mx-auto max-w-6xl px-2 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-[#1c2b22]">General ledger</h1>
          <p className="mt-1 text-sm text-[#4a5c50]">
            {selectedAccount
              ? `${selectedAccount.account_code} · ${selectedAccount.account_name}`
              : "Double-entry journal across all accounts."}
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Total debits" value={KES(summary.totalDebits)} />
          <SummaryCard label="Total credits" value={KES(summary.totalCredits)} />
          <SummaryCard
            label={selectedAccount ? "Account balance" : "Net (debits − credits)"}
            value={KES(summary.net)}
            accent
          />
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.gl_account_id} value={a.gl_account_id}>
                    {a.account_code} · {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">From date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">To date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#4a5c50]">Reference / description</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries..."
                className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
              />
            </div>
          </div>

          {(accountId || dateFrom || dateTo || search) && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-xs font-medium text-[#1c2b22] underline hover:no-underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">{error}</div>}

        {/* Ledger table */}
        <div className="overflow-x-auto rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 text-left">
              <tr>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Date</th>
                {/* <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Entry no.</th> */}
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Reference</th>
                {!accountId && <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Account</th>}
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Description</th>
                <th className="px-4 py-3 text-right font-serif font-medium text-[#1c2b22]">Debit</th>
                <th className="px-4 py-3 text-right font-serif font-medium text-[#1c2b22]">Credit</th>
                {accountId && <th className="px-4 py-3 text-right font-serif font-medium text-[#1c2b22]">Balance</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={accountId ? 7 : 7} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading ledger entries...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={accountId ? 7 : 7} className="px-4 py-8 text-center text-[#9aa79f]">
                    No ledger entries found
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.line_id} className="hover:bg-[#eee7d6]/40">
                    <td className="whitespace-nowrap px-4 py-3 text-[#4a5c50]">
                      {new Date(e.entry_date).toLocaleDateString("en-KE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    {/* <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">{e.entry_number}</td> */}
                    <td className="px-4 py-3 text-[#4a5c50]">{e.reference_type || "—"}</td>
                    {!accountId && (
                      <td className="px-4 py-3 text-[#1c2b22]">
                        {e.account_code} · {e.account_name}
                      </td>
                    )}
                    <td className="px-4 py-3 text-[#1c2b22]">{e.line_description || e.entry_description}</td>
                    <td className="px-4 py-3 text-right text-[#1c2b22]">
                      {Number(e.debit) > 0 ? KES(Number(e.debit)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[#1c2b22]">
                      {Number(e.credit) > 0 ? KES(Number(e.credit)) : "—"}
                    </td>
                    {accountId && (
                      <td className="px-4 py-3 text-right font-medium text-[#1c2b22]">
                        {e.running_balance !== null ? KES(e.running_balance) : "—"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#4a5c50]">
            {pagination.totalCount} entr{pagination.totalCount !== 1 ? "ies" : "y"} · Page {pagination.page} of{" "}
            {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="rounded-md border border-[#c9a24b]/40 px-3 py-1 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-md border border-[#c9a24b]/40 px-3 py-1 text-sm text-[#1c2b22] hover:bg-[#eee7d6] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#4a5c50]">{label}</p>
      <p className={`mt-1 font-serif text-xl ${accent ? "text-[#7a5c1e]" : "text-[#1c2b22]"}`}>{value}</p>
    </div>
  );
}