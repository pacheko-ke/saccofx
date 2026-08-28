'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/SideBar';

interface Account {
  id: string;
  accountNumber: string;
  status: string;
  balance: string;
  availableBalance: string;
  openedAt: string;
  closedAt: string | null;
  productName: string;
  interestRate: string;
  minimumBalance: string;
  memberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

const KES = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' });
const DATE = new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const CREDIT_TYPES = new Set(['deposit', 'interest_posting', 'opening_deposit', 'transfer_in']);

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-[#1c2b22] text-[#faf6ec]',
    dormant: 'bg-[#c9a24b]/30 text-[#1c2b22]',
    closed: 'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-200 text-gray-800';
}

export default function SavingsAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 50;

  const fetchData = useCallback(async (nextOffset: number, append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/savings/accounts/${accountId}?limit=${LIMIT}&offset=${nextOffset}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to load account');
      }
      setAccount(json.data.account);
      setTransactions((prev) => (append ? [...prev, ...json.data.transactions] : json.data.transactions));
      setTotal(json.data.pagination.total);
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchData(0, false);
  }, [fetchData]);

  if (loading) {
    return (
      <>
      <Sidebar></Sidebar>
      <div className="min-h-screen bg-[#eee7d6] flex items-center justify-center">
        <p className="font-serif text-[#1c2b22] text-lg">Loading account…</p>
      </div>
      </>
    );
  }

  if (error || !account) {
    return (
       <>
      <Sidebar></Sidebar>
      <div className="min-h-screen bg-[#eee7d6] flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-red-800 text-lg mb-2">{error ?? 'Account not found'}</p>
          <Link href="/dashboard/savings" className="text-[#c9a24b] underline">Back to savings</Link>
        </div>
      </div>
      </>
    );
  }

  return (
      <div className=''>
      <Sidebar></Sidebar>
    <div className="min-h-screen bg-[#eee7d6] py-8 print:bg-white px-4 pt-16 md:pt-10 md:px-20 md:mx-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header / passbook cover */}
        <div className="bg-[#1c2b22] text-[#faf6ec] rounded-t-lg px-8 py-6 border-2 border-[#c9a24b]">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <p className="uppercase tracking-widest text-xs text-[#c9a24b] mb-1">Savings Passbook</p>
              <h1 className="font-serif text-2xl">{account.firstName} {account.lastName}</h1>
              <p className="text-sm text-[#faf6ec]/80 mt-1">
                Member No. {account.memberNumber} · Account No. {account.accountNumber}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${statusBadge(account.status)}`}>
              {account.status}
            </span>
          </div>
        </div>

        {/* Balance summary */}
        <div className="bg-[#faf6ec] border-x-2 border-b-2 border-[#c9a24b] px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#1c2b22]/60">Product</p>
            <p className="font-serif text-[#1c2b22] mt-1">{account.productName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#1c2b22]/60">Balance</p>
            <p className="font-serif text-[#1c2b22] text-xl mt-1">{KES.format(Number(account.balance))}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#1c2b22]/60">Available</p>
            <p className="font-serif text-[#1c2b22] mt-1">{KES.format(Number(account.availableBalance))}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#1c2b22]/60">Opened</p>
            <p className="font-serif text-[#1c2b22] mt-1">{DATE.format(new Date(account.openedAt))}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 py-4 print:hidden">
          <Link
            href={`/portal/admin/members/${account.memberId}`}
            className="px-4 py-2 text-sm font-serif border border-[#1c2b22] text-[#1c2b22] rounded hover:bg-[#1c2b22] hover:text-[#faf6ec] transition"
          >
            View Member
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-serif bg-[#c9a24b] text-[#1c2b22] rounded hover:bg-[#b8923f] transition"
          >
            Print Statement
          </button>
        </div>

        {/* Ledger */}
        <div className="bg-[#faf6ec] border-2 border-[#c9a24b] rounded-b-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1c2b22] text-[#faf6ec] font-serif">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Reference</th>
                <th className="text-right px-4 py-3">Debit</th>
                <th className="text-right px-4 py-3">Credit</th>
                <th className="text-right px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#1c2b22]/60 font-serif">
                    No transactions yet
                  </td>
                </tr>
              )}
              {transactions.map((txn, i) => {
                const isCredit = CREDIT_TYPES.has(txn.transactionType);
                return (
                  <tr key={txn.id} className={i % 2 === 0 ? 'bg-[#faf6ec]' : 'bg-[#eee7d6]'}>
                    <td className="px-4 py-3 text-[#1c2b22] whitespace-nowrap">{DATE.format(new Date(txn.createdAt))}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      {txn.description ?? txn.transactionType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-[#1c2b22]/70 hidden md:table-cell">{txn.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-[#1c2b22]">
                      {!isCredit ? KES.format(Number(txn.amount)) : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-[#1c2b22]">
                      {isCredit ? KES.format(Number(txn.amount)) : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#1c2b22]">
                      {KES.format(Number(txn.balanceAfter))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {transactions.length < total && (
            <div className="text-center py-4 border-t border-[#c9a24b]/40 print:hidden">
              <button
                onClick={() => fetchData(offset + LIMIT, true)}
                disabled={loadingMore}
                className="text-[#c9a24b] font-serif underline disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : `Load more (${total - transactions.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}