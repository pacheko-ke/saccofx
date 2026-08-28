"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ShareStatus = "active" | "dormant" | "transferred";

interface ShareHolding {
  memberNo: string;
  firstName:string;
  lastName:string;
  name: string;
  certificateNo: string;
  sharesHeld: number;
  dateJoined: string;
  lastActivityAt: string;
  status: ShareStatus;
}

interface MemberSearchResult {
  id: string;
  memberNo: string;
  name: string;
}

const STATUS_PILL: Record<ShareStatus, string> = {

  active: "bg-[#e7efe3] text-[#2f5233] border border-[#b9cdb2]",
  dormant: "bg-[#f4ecd8] text-[#8a6a1f] border border-[#d9c48f]",
  transferred: "bg-[#f0e2e0] text-[#8a3b2f] border border-[#d9b3ac]",
};

function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ShareHoldingsPage() {
  const [holdings, setHoldings] = useState<ShareHolding[]>([]);
  const [parValueKes, setParValueKes] = useState(100);
  const [minShares, setMinShares] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ShareStatus>("all");
  const [complianceFilter, setComplianceFilter] = useState<"all" | "below">("all");

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const loadHoldings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/shares", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = await res.json();
      setHoldings(data.holdings ?? []);
      if (data.parValueKes) setParValueKes(data.parValueKes);
      if (data.minShares) setMinShares(data.minShares);
    } catch (err) {
      console.error("Failed to load share holdings:", err);
      setError("Couldn't load share holdings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadHoldings();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHoldings]);

  const rows = useMemo(() => {
    // const name = firstName + lastName ;
    return holdings.filter((h) => {
      const matchesQuery =
        query.trim() === "" ||
        h.name.toLowerCase().includes(query.toLowerCase()) ||
        h.memberNo.toLowerCase().includes(query.toLowerCase()) ||
        h.certificateNo.toLowerCase().includes(query.toLowerCase());

      const matchesStatus = statusFilter === "all" || h.status === statusFilter;

      const matchesCompliance =
        complianceFilter === "all" || (complianceFilter === "below" && h.sharesHeld < minShares);

      return matchesQuery && matchesStatus && matchesCompliance;
    });
  }, [holdings, query, statusFilter, complianceFilter, minShares]);

  const totals = useMemo(() => {
    const totalShares = holdings.reduce((sum, h) => sum + h.sharesHeld, 0);
    const totalCapital = totalShares * parValueKes;
    const shareholders = holdings.filter((h) => h.sharesHeld > 0).length;
    const belowMin = holdings.filter((h) => h.sharesHeld < minShares).length;
    const avgShares = shareholders > 0 ? Math.round(totalShares / shareholders) : 0;
    return { totalShares, totalCapital, shareholders, belowMin, avgShares };
  }, [holdings, parValueKes, minShares]);

  return (
    <div className="min-h-screen bg-[#faf6ec] font-[IBM_Plex_Sans] placeholder-sky-100 pt-10 md:pl-16">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-[#c9a24b]/40 pb-6">
          <p className="font-[IBM_Plex_Mono] text-xs uppercase tracking-[0.2em] text-[#8a7a4f]">
            SaccoFX Pro · Shares Register
          </p>
          <h1 className="mt-1 font-[Source_Serif_4] text-3xl font-semibold text-[#1c2b22]">
            Share Holdings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#4a5a4c]">
            Share capital held by each member, at a par value of{" "}
            <span className="font-[IBM_Plex_Mono]">{formatKES(parValueKes)}</span> per share.
            Minimum required holding is{" "}
            <span className="font-[IBM_Plex_Mono]">
              {minShares} shares ({formatKES(minShares * parValueKes)})
            </span>
            .
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-[#d9b3ac] bg-[#f0e2e0] px-4 py-3 text-sm text-[#8a3b2f]">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total Share Capital" value={formatKES(totals.totalCapital)} loading={loading} />
          <SummaryCard label="Total Shares in Issue" value={totals.totalShares.toLocaleString()} loading={loading} />
          <SummaryCard label="Shareholding Members" value={totals.shareholders.toString()} loading={loading} />
          <SummaryCard
            label="Below Minimum"
            value={totals.belowMin.toString()}
            accent={totals.belowMin > 0 ? "warn" : undefined}
            loading={loading}
          />
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, member no, or certificate no…"
            className="w-full rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#8a8a7a] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b] sm:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="transferred">Transferred</option>
            </select>
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value as typeof complianceFilter)}
              className="rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
            >
              <option value="all">All members</option>
              <option value="below">Below minimum only</option>
            </select>
            <button
              type="button"
              onClick={() => setIsPurchaseModalOpen(true)}
              className="rounded-md border border-[#1c2b22] bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-[#2a3d2f]"
            >
              + Record Share Purchase
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-[#c9a24b]/40 bg-[#eee7d6] shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#c9a24b]/30">
              <thead>
                <tr className="bg-[#1c2b22]">
                  {[
                    "Member",
                    
                    "Shares Held",
                    "Value at Par",
                    "Date Joined",
                    "Last Activity",
                    "Compliance",
                    "Status",
                  ].map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-3 text-left font-[Source_Serif_4] text-xs font-semibold uppercase tracking-wide text-[#eee7d6]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c9a24b]/20 bg-[#faf6ec]">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8a8a7a]">
                      Loading share holdings…
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((h) => {
                    const value = h.sharesHeld * parValueKes;
                    const compliant = h.sharesHeld >= minShares;
                    return (
                      <tr key={h.memberNo} className="transition hover:bg-[#f2ead6]">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="text-sm font-medium text-[#1c2b22]">{h.name}</div>
                          
                           <a href={`/members/${h.memberNo}`}
                            className="text-xs text-[#8a6a1f] underline decoration-[#c9a24b] decoration-1 underline-offset-2 hover:text-[#c9a24b]"
                          >
                            {h.memberNo}
                          </a>
                        </td>
                        {/* <td className="whitespace-nowrap px-4 py-3 font-[IBM_Plex_Mono] text-sm text-[#4a5a4c]">
                          {h.certificateNo}
                        </td> */}
                        <td className="whitespace-nowrap px-4 py-3 font-[IBM_Plex_Mono] text-sm text-[#1c2b22]">
                          {h.sharesHeld.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-[IBM_Plex_Mono] text-sm text-[#1c2b22]">
                          {formatKES(value)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#4a5a4c]">
                          {formatDate(h.dateJoined)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-[#4a5a4c]">
                          {formatDate(h.lastActivityAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              compliant
                                ? "border border-[#b9cdb2] bg-[#e7efe3] text-[#2f5233]"
                                : "border border-[#d9c48f] bg-[#f4ecd8] text-[#8a6a1f]"
                            }`}
                          >
                            {compliant ? "Compliant" : "Below Minimum"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_PILL[h.status]}`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8a8a7a]">
                      No members match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-[#8a8a7a]">
          {loading ? "Loading…" : `Showing ${rows.length} of ${holdings.length} members · Avg. holding ${totals.avgShares} shares`}
        </p>
      </div>

      {isPurchaseModalOpen && (
        <RecordSharePurchaseModal
          parValueKes={parValueKes}
          onClose={() => setIsPurchaseModalOpen(false)}
          onSuccess={() => {
            setIsPurchaseModalOpen(false);
            loadHoldings();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record Share Purchase Modal
// ---------------------------------------------------------------------------

function RecordSharePurchaseModal({
  parValueKes,
  onClose,
  onSuccess,
}: {
  parValueKes: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [sharesInput, setSharesInput] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Debounced member search
  useEffect(() => {
    if (selectedMember) return; // don't re-search once a member is picked
    if (memberQuery.trim().length < 2) {
      setMemberResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/members/search?q=${encodeURIComponent(memberQuery)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setMemberResults(data.members ?? []);
      } catch (err) {
        console.error("Member search failed:", err);
        setMemberResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [memberQuery, selectedMember]);

  const shares = Number.parseInt(sharesInput, 10);
  const validShares = Number.isInteger(shares) && shares > 0;
  const valueKes = validShares ? shares * parValueKes : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedMember) {
      setFormError("Select a member before recording the purchase.");
      return;
    }
    if (!validShares) {
      setFormError("Enter a valid number of shares.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/shares/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember.id,
          shares,
          certificateNo: certificateNo.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }

      onSuccess();
    } catch (err) {
      console.error("Failed to record share purchase:", err);
      setFormError(err instanceof Error ? err.message : "Failed to record purchase. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/60 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-[#c9a24b]/50 bg-[#faf6ec] shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#c9a24b]/40 bg-[#1c2b22] px-6 py-4 rounded-t-lg">
          <div>
            <p className="font-[IBM_Plex_Mono] text-[11px] uppercase tracking-[0.2em] text-[#c9a24b]">
              Shares Register
            </p>
            <h2 className="mt-0.5 font-[Source_Serif_4] text-xl font-semibold text-[#faf6ec]">
              Record Share Purchase
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[#eee7d6] transition hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {formError && (
            <div className="mb-4 rounded-md border border-[#d9b3ac] bg-[#f0e2e0] px-3 py-2 text-sm text-[#8a3b2f]">
              {formError}
            </div>
          )}

          {/* Member selection */}
          <div className="mb-4">
            <label className="mb-1 block font-[IBM_Plex_Mono] text-xs uppercase tracking-wide text-[#6b6b52]">
              Member
            </label>

            {selectedMember ? (
              <div className="flex items-center justify-between rounded-md border border-[#b9cdb2] bg-[#e7efe3] px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-[#1c2b22]">{selectedMember.name}</div>
                  <div className="text-xs text-[#4a5a4c]">{selectedMember.memberNo}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMember(null);
                    setMemberQuery("");
                  }}
                  className="text-xs text-[#8a6a1f] underline underline-offset-2 hover:text-[#c9a24b]"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search by name or member no…"
                  autoFocus
                  className="w-full rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#8a8a7a] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
                />
                {memberQuery.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[#c9a24b]/40 bg-white shadow-md">
                    {searching && (
                      <div className="px-3 py-2 text-sm text-[#8a8a7a]">Searching…</div>
                    )}
                    {!searching && memberResults.length === 0 && (
                      <div className="px-3 py-2 text-sm text-[#8a8a7a]">No members found.</div>
                    )}
                    {!searching &&
                      memberResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setMemberResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f2ead6]"
                        >
                          <span className="font-medium text-[#1c2b22]">{m.name}</span>{" "}
                          <span className="text-xs text-[#8a8a7a]">{m.memberNo}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shares & certificate */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-[IBM_Plex_Mono] text-xs uppercase tracking-wide text-[#6b6b52]">
                Shares Purchased
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                placeholder="e.g. 50"
                className="w-full rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm font-[IBM_Plex_Mono] text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              />
            </div>
            <div>
              <label className="mb-1 block font-[IBM_Plex_Mono] text-xs uppercase tracking-wide text-[#6b6b52]">
                Certificate No. <span className="normal-case text-[#8a8a7a]">(optional)</span>
              </label>
              <input
                type="text"
                value={certificateNo}
                onChange={(e) => setCertificateNo(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm font-[IBM_Plex_Mono] text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              />
            </div>
          </div>

          {/* Value at par preview */}
          <div className="mb-4 flex items-center justify-between rounded-md border border-[#c9a24b]/40 bg-[#eee7d6] px-3 py-2">
            <span className="font-[IBM_Plex_Mono] text-xs uppercase tracking-wide text-[#6b6b52]">
              Value at Par
            </span>
            <span className="font-[Source_Serif_4] text-lg font-semibold text-[#1c2b22]">
              {formatKES(valueKes)}
            </span>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="mb-1 block font-[IBM_Plex_Mono] text-xs uppercase tracking-wide text-[#6b6b52]">
              Notes <span className="normal-case text-[#8a8a7a]">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Payment via M-Pesa, reference SFX-88213"
              className="w-full resize-none rounded-md border border-[#c9a24b]/50 bg-white/70 px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#8a8a7a] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#c9a24b]/50 bg-white/70 px-4 py-2 text-sm font-medium text-[#4a5a4c] transition hover:bg-[#f2ead6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedMember || !validShares}
              className="rounded-md border border-[#1c2b22] bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] transition hover:bg-[#2a3d2f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Recording…" : "Record Purchase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent?: "warn";
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#c9a24b]/40 bg-[#eee7d6] px-4 py-4 shadow-sm">
      <p className="font-[IBM_Plex_Mono] text-[11px] uppercase tracking-wide text-[#6b6b52]">
        {label}
      </p>
      <p
        className={`mt-1 font-[Source_Serif_4] text-2xl font-semibold ${
          accent === "warn" && value !== "0" ? "text-[#8a3b2f]" : "text-[#1c2b22]"
        }`}
      >
        {loading ? "—" : value}
      </p>
    </div>
  );
}