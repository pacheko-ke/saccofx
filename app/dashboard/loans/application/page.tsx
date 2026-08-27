'use client';

import { useEffect, useState, useCallback } from 'react';

type Loan = {
  loanId: string;
  principalAmount: number;
  termMonths: number;
  interestRate: number;
  purpose: string;
  status: string;
  appliedAt: string;
  productName: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  guarantorsVerified: number;
  guarantorsTotal: number;
  hasArrearsFlag: boolean;
};

type Kpis = {
  pendingCount: number;
  awaitingSecondCount: number;
  approvedTodayCount: number;
  totalValuePending: number;
};

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'pending_second_approval', label: 'Awaiting 2nd Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function LoanApprovalsPage() {
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: tab, search });
    const res = await fetch(`/api/v1/loans/pending?${qs}`);
    if (res.ok) {
      const data = await res.json();
      setLoans(data.loans);
      setKpis(data.kpis);
    }
    setLoading(false);
  }, [tab, search]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  async function handleApprove(loanId: string) {
    setActionError('');
    const res = await fetch(`/api/v1/loans/${loanId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error ?? 'Approval failed');
      return;
    }
    setSelected(null);
    setComment('');
    fetchLoans();
  }

  async function handleReject(loanId: string) {
    if (!rejectReason.trim()) {
      setActionError('Please provide a rejection reason');
      return;
    }
    setActionError('');
    const res = await fetch(`/api/admin/loans/${loanId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error ?? 'Rejection failed');
      return;
    }
    setSelected(null);
    setRejectReason('');
    setShowRejectBox(false);
    fetchLoans();
  }

  return (
    <div className="min-h-screen md:pl-20" style={{ background: '#faf6ec' }}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1
          className="text-3xl mb-1"
          style={{ fontFamily: 'Georgia, serif', color: '#1c2b22' }}
        >
          Loan Approvals
        </h1>
        <p className="text-sm mb-8" style={{ color: '#6b6152' }}>
          Review, approve, or decline loan applications awaiting sign-off.
        </p>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pending', value: kpis?.pendingCount ?? '—' },
            { label: 'Awaiting 2nd Approval', value: kpis?.awaitingSecondCount ?? '—' },
            { label: 'Approved Today', value: kpis?.approvedTodayCount ?? '—' },
            {
              label: 'Total Value Pending',
              value: kpis
                ? `KES ${Number(kpis.totalValuePending).toLocaleString()}`
                : '—',
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-lg p-4 border"
              style={{ background: '#eee7d6', borderColor: '#c9a24b55' }}
            >
              <div className="text-xs uppercase tracking-wide" style={{ color: '#6b6152' }}>
                {k.label}
              </div>
              <div
                className="text-2xl mt-1"
                style={{ fontFamily: 'Georgia, serif', color: '#1c2b22' }}
              >
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-md text-sm border transition"
                style={{
                  background: tab === t.key ? '#1c2b22' : 'transparent',
                  color: tab === t.key ? '#faf6ec' : '#1c2b22',
                  borderColor: '#1c2b22',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member name or number…"
            className="px-3 py-2 rounded-md border text-sm w-64"
            style={{ borderColor: '#c9a24b', background: '#fff' }}
          />
        </div>

        {/* Loan list */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#c9a24b55' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1c2b22', color: '#faf6ec' }}>
                <th className="text-left px-4 py-3 font-normal">Member</th>
                <th className="text-left px-4 py-3 font-normal">Product</th>
                <th className="text-right px-4 py-3 font-normal">Amount</th>
                <th className="text-left px-4 py-3 font-normal">Term</th>
                <th className="text-left px-4 py-3 font-normal">Guarantors</th>
                <th className="text-left px-4 py-3 font-normal">Flags</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: '#6b6152' }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && loans.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: '#6b6152' }}>
                    No loans in this queue.
                  </td>
                </tr>
              )}
              {loans.map((loan) => (
                <tr
                  key={loan.loanId}
                  className="border-t cursor-pointer hover:bg-[#eee7d6]"
                  style={{ borderColor: '#c9a24b33' }}
                  onClick={() => {
                    setSelected(loan);
                    setActionError('');
                    setShowRejectBox(false);
                    setComment('');
                    setRejectReason('');
                  }}
                >
                  <td className="px-4 py-3">
                    <div style={{ color: '#1c2b22' }}>{loan.memberName}</div>
                    <div className="text-xs" style={{ color: '#6b6152' }}>
                      {loan.memberNumber}
                    </div>
                  </td>
                  <td className="px-4 py-3">{loan.productName}</td>
                  <td className="px-4 py-3 text-right">
                    KES {Number(loan.principalAmount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{loan.termMonths} mo</td>
                  <td className="px-4 py-3">
                    {loan.guarantorsVerified}/{loan.guarantorsTotal} verified
                  </td>
                  <td className="px-4 py-3">
                    {loan.hasArrearsFlag && (
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: '#7a2e2e22', color: '#7a2e2e' }}
                      >
                        Arrears history
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: '#c9a24b' }}>
                    Review →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 flex justify-end"
          style={{ background: 'rgba(28,43,34,0.4)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md h-full overflow-y-auto p-6"
            style={{ background: '#faf6ec' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl mb-4" style={{ fontFamily: 'Georgia, serif', color: '#1c2b22' }}>
              {selected.memberName}
            </h2>
            <div className="space-y-2 text-sm mb-6" style={{ color: '#1c2b22' }}>
              <div>Product: {selected.productName}</div>
              <div>Amount: KES {Number(selected.principalAmount).toLocaleString()}</div>
              <div>Term: {selected.termMonths} months at {selected.interestRate}%</div>
              <div>Purpose: {selected.purpose}</div>
              <div>
                Guarantors verified: {selected.guarantorsVerified}/{selected.guarantorsTotal}
              </div>
              {selected.hasArrearsFlag && (
                <div style={{ color: '#7a2e2e' }}>⚠ Member has prior arrears history</div>
              )}
              {selected.status === 'pending_second_approval' && (
                <div style={{ color: '#c9a24b' }}>
                  ⚠ First approval already recorded — requires a second, different approver
                </div>
              )}
            </div>

            {selected.guarantorsVerified < selected.guarantorsTotal && (
              <div
                className="text-xs p-3 rounded mb-4"
                style={{ background: '#7a2e2e11', color: '#7a2e2e' }}
              >
                Not all guarantors have completed OTP verification. Approving now overrides
                this check.
              </div>
            )}

            {actionError && (
              <div
                className="text-xs p-3 rounded mb-4"
                style={{ background: '#7a2e2e22', color: '#7a2e2e' }}
              >
                {actionError}
              </div>
            )}

            {['pending', 'pending_second_approval'].includes(selected.status) && (
              <div className="space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional approval comment…"
                  className="w-full text-sm p-2 rounded border"
                  style={{ borderColor: '#c9a24b' }}
                  rows={2}
                />
                <button
                  onClick={() => handleApprove(selected.loanId)}
                  className="w-full py-2 rounded-md text-sm"
                  style={{ background: '#1c2b22', color: '#faf6ec' }}
                >
                  Approve
                </button>

                {!showRejectBox ? (
                  <button
                    onClick={() => setShowRejectBox(true)}
                    className="w-full py-2 rounded-md text-sm border"
                    style={{ borderColor: '#7a2e2e', color: '#7a2e2e' }}
                  >
                    Reject
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (required)…"
                      className="w-full text-sm p-2 rounded border"
                      style={{ borderColor: '#7a2e2e' }}
                      rows={2}
                    />
                    <button
                      onClick={() => handleReject(selected.loanId)}
                      className="w-full py-2 rounded-md text-sm"
                      style={{ background: '#7a2e2e', color: '#faf6ec' }}
                    >
                      Confirm Rejection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}