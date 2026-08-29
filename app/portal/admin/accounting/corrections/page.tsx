'use client';

import Sidebar from '@/app/components/SideBar';
import { useState, useEffect, useCallback } from 'react';

// ── SaccoFX Pro passbook/ledger brand ──
// ink-green #1c2b22 · cream #faf6ec · parchment #eee7d6 · brass gold #c9a24b
// serif headings throughout

type SearchResult = {
  id: string;
  transactionType: string;
  memberId: string;
  memberName: string;
  amount: number;
  receiptNumber: string;
  createdAt: string;
  description: string | null;
  alreadyReversed: boolean;
};

type Reversal = {
  id: string;
  transactionType: string;
  originalTransactionId: string;
  memberId: string;
  memberName: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reversalTransactionId: string | null;
  executedAt: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  savings_deposit: 'Savings Deposit',
  savings_withdrawal: 'Savings Withdrawal',
  loan_repayment: 'Loan Repayment',
  share_purchase: 'Share Purchase',
  gl_entry: 'GL Journal Entry',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[#c9a24b]/15 text-[#8a6a20] border-[#c9a24b]/40',
  executed: 'bg-[#1c2b22]/10 text-[#1c2b22] border-[#1c2b22]/30',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  approved: 'bg-[#1c2b22]/10 text-[#1c2b22] border-[#1c2b22]/30',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

function currentUserId(): string {
  // Wire this to your actual client-side auth/session context.
  return typeof window !== 'undefined' ? (window as any).__SFX_USER_ID__ ?? '' : '';
}

export default function ReversalsPage() {
  const [tab, setTab] = useState<'new' | 'queue' | 'history'>('queue');

  return (

    <div className="min-h-screen bg-[#faf6ec] text-[#1c2b22]">
      <Sidebar></Sidebar>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 border-b-2 border-[#1c2b22]/15 pb-6">
          <h1 className="font-serif text-3xl tracking-tight text-[#1c2b22]">
            Reversals &amp; Corrections
          </h1>
          <p className="mt-1 text-sm text-[#1c2b22]/70">
            Every reversal is posted as a new, equal-and-opposite ledger entry — original
            transactions are never edited or deleted. All executions require a second
            authorised approver (maker-checker).
          </p>
        </header>

        <nav className="mb-8 flex gap-1 border-b border-[#1c2b22]/15">
          {([
            ['queue', 'Pending Approvals'],
            ['new', 'Request a Reversal'],
            ['history', 'History'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 font-serif text-sm transition-colors ${
                tab === key
                  ? 'border-b-2 border-[#c9a24b] text-[#1c2b22]'
                  : 'text-[#1c2b22]/50 hover:text-[#1c2b22]/80'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'new' && <RequestReversalPanel />}
        {tab === 'queue' && <ReversalQueuePanel status="pending" showActions />}
        {tab === 'history' && <ReversalQueuePanel status="" showActions={false} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 1: search a transaction and file a reversal request
// ─────────────────────────────────────────────────────────────────────────

function RequestReversalPanel() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/transactions/search?q=${encodeURIComponent(query)}&type=${type}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      setResults(data.results);
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  async function submitRequest() {
    if (!selected || reason.trim().length < 10) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/reversals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: selected.transactionType,
          originalTransactionId: selected.id,
          memberId: selected.memberId,
          amount: selected.amount,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit');
      setMessage({ kind: 'success', text: 'Reversal request filed — awaiting a second approver.' });
      setSelected(null);
      setReason('');
      setResults(r => r.map(x => (x.id === selected.id ? { ...x, alreadyReversed: true } : x)));
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#1c2b22]/15 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search by receipt no., member name, or member no."
            className="flex-1 rounded-md border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="rounded-md border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm"
          >
            <option value="all">All transaction types</option>
            <option value="savings_deposit">Savings Deposits</option>
            <option value="savings_withdrawal">Savings Withdrawals</option>
            <option value="loan_repayment">Loan Repayments</option>
          </select>
          <button
            onClick={search}
            disabled={loading}
            className="rounded-md bg-[#1c2b22] px-5 py-2 font-serif text-sm text-[#faf6ec] transition-colors hover:bg-[#1c2b22]/90 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-md border px-4 py-2.5 text-sm ${
            message.kind === 'success'
              ? 'border-[#1c2b22]/25 bg-[#1c2b22]/5 text-[#1c2b22]'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#1c2b22]/15 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c2b22]/15 bg-[#eee7d6] text-left font-serif text-[#1c2b22]/80">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Member</th>
                <th className="px-4 py-2.5">Receipt</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} className="border-b border-[#1c2b22]/10 last:border-0">
                  <td className="px-4 py-2.5 text-[#1c2b22]/70">
                    {new Date(r.createdAt).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-4 py-2.5">{TYPE_LABELS[r.transactionType] ?? r.transactionType}</td>
                  <td className="px-4 py-2.5">{r.memberName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.receiptNumber}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    KES {r.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.alreadyReversed ? (
                      <span className="text-xs text-[#1c2b22]/40">Already filed</span>
                    ) : (
                      <button
                        onClick={() => setSelected(r)}
                        className="font-serif text-xs text-[#8a6a20] underline decoration-[#c9a24b] hover:text-[#1c2b22]"
                      >
                        Reverse this
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="rounded-lg border-2 border-[#c9a24b]/50 bg-white p-5 shadow-sm">
          <h3 className="font-serif text-lg text-[#1c2b22]">Confirm Reversal Request</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-[#1c2b22]/60">Member</dt>
            <dd>{selected.memberName}</dd>
            <dt className="text-[#1c2b22]/60">Type</dt>
            <dd>{TYPE_LABELS[selected.transactionType]}</dd>
            <dt className="text-[#1c2b22]/60">Receipt No.</dt>
            <dd className="font-mono">{selected.receiptNumber}</dd>
            <dt className="text-[#1c2b22]/60">Amount</dt>
            <dd className="font-mono">KES {selected.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</dd>
          </dl>

          <label className="mt-4 block text-sm text-[#1c2b22]/80">
            Reason for reversal (required, min. 10 characters)
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Duplicate M-Pesa STK push credited twice against receipt SFX-2291"
            className="mt-1 w-full rounded-md border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={submitRequest}
              disabled={submitting || reason.trim().length < 10}
              className="rounded-md bg-[#1c2b22] px-5 py-2 font-serif text-sm text-[#faf6ec] hover:bg-[#1c2b22]/90 disabled:opacity-50"
            >
              {submitting ? 'Filing…' : 'File Reversal Request'}
            </button>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md border border-[#1c2b22]/25 px-5 py-2 font-serif text-sm text-[#1c2b22]/70 hover:bg-[#eee7d6]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab 2 & 3: queue of pending approvals / full history
// ─────────────────────────────────────────────────────────────────────────

function ReversalQueuePanel({ status, showActions }: { status: string; showActions: boolean }) {
  const [items, setItems] = useState<Reversal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const userId = currentUserId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = status ? `/api/v1/reversals?status=${status}` : '/api/v1/reversals';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setItems(data.reversals);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reversals/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Approval failed');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (rejectReason.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reversals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Rejection failed');
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-[#1c2b22]/60">Loading…</p>;

  return (
    <>
   
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {items?.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#1c2b22]/20 bg-white/50 px-4 py-8 text-center text-sm text-[#1c2b22]/50">
          {status === 'pending' ? 'No reversal requests awaiting approval.' : 'No records yet.'}
        </p>
      )}

      {items?.map(item => {
        const isOwnRequest = item.requestedBy === userId;
        return (
          <div key={item.id} className="rounded-lg border border-[#1c2b22]/15 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-base text-[#1c2b22]">{item.memberName}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[item.status]}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-[#1c2b22]/60">
                  {TYPE_LABELS[item.transactionType] ?? item.transactionType} · KES{' '}
                  {item.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right text-xs text-[#1c2b22]/50">
                <p>Requested by {item.requestedByName}</p>
                <p>{new Date(item.requestedAt).toLocaleString('en-KE')}</p>
              </div>
            </div>

            <p className="mt-3 rounded-md bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22]/80">
              <span className="font-medium">Reason: </span>
              {item.reason}
            </p>

            {item.status === 'rejected' && item.rejectionReason && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                <span className="font-medium">Rejection reason: </span>
                {item.rejectionReason}
              </p>
            )}

            {item.status === 'executed' && (
              <p className="mt-2 text-xs text-[#1c2b22]/50">
                Approved by {item.reviewedByName} on{' '}
                {item.executedAt && new Date(item.executedAt).toLocaleString('en-KE')} — reversing entry posted.
              </p>
            )}

            {showActions && item.status === 'pending' && (
              <div className="mt-4 border-t border-[#1c2b22]/10 pt-4">
                {isOwnRequest ? (
                  <p className="text-xs italic text-[#1c2b22]/45">
                    Maker-checker: you filed this request, so a different authorised reviewer must approve it.
                  </p>
                ) : rejectingId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="Reason for rejecting this reversal…"
                      className="w-full rounded-md border border-[#1c2b22]/25 bg-[#faf6ec] px-3 py-2 text-sm focus:border-[#c9a24b] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reject(item.id)}
                        disabled={busyId === item.id || rejectReason.trim().length < 5}
                        className="rounded-md bg-red-700 px-4 py-1.5 text-sm text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        className="rounded-md border border-[#1c2b22]/25 px-4 py-1.5 text-sm hover:bg-[#eee7d6]"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(item.id)}
                      disabled={busyId === item.id}
                      className="rounded-md bg-[#1c2b22] px-4 py-1.5 font-serif text-sm text-[#faf6ec] hover:bg-[#1c2b22]/90 disabled:opacity-50"
                    >
                      {busyId === item.id ? 'Posting reversal…' : 'Approve & Execute'}
                    </button>
                    <button
                      onClick={() => setRejectingId(item.id)}
                      className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}