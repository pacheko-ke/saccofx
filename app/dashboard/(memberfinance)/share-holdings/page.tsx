"use client";

/**
 * Share Holdings — /shares
 *
 * Lists every member's share capital position: shares held, certificate
 * number, value at par, and whether they meet the SACCO's minimum share
 * capital requirement (a prerequisite for loan eligibility and dividend
 * participation under most SASRA-regulated by-laws).
 *
 * Wiring notes:
 * - Replace MOCK_HOLDINGS with a fetch to e.g. GET /api/shares which should
 *   join Member + ShareAccount (+ latest ShareTransaction for lastActivityAt).
 * - PAR_VALUE_KES and MIN_SHARES should come from the SACCO's config table,
 *   not be hardcoded — left as constants here for the demo.
 * - Filtering/search is client-side per existing convention (members list,
 *   loan products list).
 */

import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types & demo data
// ---------------------------------------------------------------------------

type ShareStatus = "active" | "dormant" | "transferred";

interface ShareHolding {
  memberNo: string;
  name: string;
  certificateNo: string;
  sharesHeld: number;
  dateJoined: string; // ISO date
  lastActivityAt: string; // ISO date
  status: ShareStatus;
}

const PAR_VALUE_KES = 100;
const MIN_SHARES = 100; // KES 10,000 minimum share capital

const MOCK_HOLDINGS: ShareHolding[] = [
  { memberNo: "SFX-0001", name: "Wanjiru Kamau", certificateNo: "CERT-00147", sharesHeld: 420, dateJoined: "2019-03-11", lastActivityAt: "2026-06-02", status: "active" },
  { memberNo: "SFX-0002", name: "Otieno Odhiambo", certificateNo: "CERT-00148", sharesHeld: 85, dateJoined: "2021-07-22", lastActivityAt: "2025-11-14", status: "active" },
  { memberNo: "SFX-0003", name: "Achieng Njoroge", certificateNo: "CERT-00149", sharesHeld: 1250, dateJoined: "2016-01-09", lastActivityAt: "2026-07-30", status: "active" },
  { memberNo: "SFX-0004", name: "Mutiso Kilonzo", certificateNo: "CERT-00150", sharesHeld: 100, dateJoined: "2022-05-02", lastActivityAt: "2024-02-18", status: "dormant" },
  { memberNo: "SFX-0005", name: "Nyambura Gitau", certificateNo: "CERT-00151", sharesHeld: 60, dateJoined: "2023-09-14", lastActivityAt: "2026-01-20", status: "active" },
  { memberNo: "SFX-0006", name: "Barasa Wafula", certificateNo: "CERT-00152", sharesHeld: 300, dateJoined: "2018-11-30", lastActivityAt: "2026-05-11", status: "active" },
  { memberNo: "SFX-0007", name: "Chebet Kiprop", certificateNo: "CERT-00153", sharesHeld: 0, dateJoined: "2020-02-17", lastActivityAt: "2023-08-01", status: "transferred" },
  { memberNo: "SFX-0008", name: "Mwangi Njeri", certificateNo: "CERT-00154", sharesHeld: 150, dateJoined: "2024-01-06", lastActivityAt: "2026-07-02", status: "active" },
  { memberNo: "SFX-0009", name: "Auma Owino", certificateNo: "CERT-00155", sharesHeld: 40, dateJoined: "2024-10-19", lastActivityAt: "2026-03-09", status: "active" },
  { memberNo: "SFX-0010", name: "Karanja Muturi", certificateNo: "CERT-00156", sharesHeld: 780, dateJoined: "2017-06-25", lastActivityAt: "2026-07-18", status: "active" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const STATUS_PILL: Record<ShareStatus, string> = {
  active: "bg-[#e7efe3] text-[#2f5233] border border-[#b9cdb2]",
  dormant: "bg-[#f4ecd8] text-[#8a6a1f] border border-[#d9c48f]",
  transferred: "bg-[#f0e2e0] text-[#8a3b2f] border border-[#d9b3ac]",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShareHoldingsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ShareStatus>("all");
  const [complianceFilter, setComplianceFilter] = useState<"all" | "below">("all");

  const rows = useMemo(() => {
    return MOCK_HOLDINGS.filter((h) => {
      const matchesQuery =
        query.trim() === "" ||
        h.name.toLowerCase().includes(query.toLowerCase()) ||
        h.memberNo.toLowerCase().includes(query.toLowerCase()) ||
        h.certificateNo.toLowerCase().includes(query.toLowerCase());

      const matchesStatus = statusFilter === "all" || h.status === statusFilter;

      const matchesCompliance =
        complianceFilter === "all" || (complianceFilter === "below" && h.sharesHeld < MIN_SHARES);

      return matchesQuery && matchesStatus && matchesCompliance;
    });
  }, [query, statusFilter, complianceFilter]);

  const totals = useMemo(() => {
    const totalShares = MOCK_HOLDINGS.reduce((sum, h) => sum + h.sharesHeld, 0);
    const totalCapital = totalShares * PAR_VALUE_KES;
    const shareholders = MOCK_HOLDINGS.filter((h) => h.sharesHeld > 0).length;
    const belowMin = MOCK_HOLDINGS.filter((h) => h.sharesHeld < MIN_SHARES).length;
    const avgShares = shareholders > 0 ? Math.round(totalShares / shareholders) : 0;
    return { totalShares, totalCapital, shareholders, belowMin, avgShares };
  }, []);

  return (
    <div className="min-h-screen bg-[#faf6ec] font-[IBM_Plex_Sans] placeholder-sky-100 pt-10 pl-16">
      
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 border-b border-[#c9a24b]/40 pb-6">
          <p className="font-[IBM_Plex_Mono] text-xs uppercase tracking-[0.2em] text-[#8a7a4f]">
            SaccoFX Pro · Shares Register
          </p>
          <h1 className="mt-1 font-[Source_Serif_4] text-3xl font-semibold text-[#1c2b22]">
            Share Holdings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#4a5a4c]">
            Share capital held by each member, at a par value of{" "}
            <span className="font-[IBM_Plex_Mono]">{formatKES(PAR_VALUE_KES)}</span> per share.
            Minimum required holding is{" "}
            <span className="font-[IBM_Plex_Mono]">
              {MIN_SHARES} shares ({formatKES(MIN_SHARES * PAR_VALUE_KES)})
            </span>
            .
          </p>
        </header>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total Share Capital" value={formatKES(totals.totalCapital)} />
          <SummaryCard label="Total Shares in Issue" value={totals.totalShares.toLocaleString()} />
          <SummaryCard label="Shareholding Members" value={totals.shareholders.toString()} />
          <SummaryCard
            label="Below Minimum"
            value={totals.belowMin.toString()}
            accent={totals.belowMin > 0 ? "warn" : undefined}
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
                    "Certificate No.",
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
                {rows.map((h) => {
                  const value = h.sharesHeld * PAR_VALUE_KES;
                  const compliant = h.sharesHeld >= MIN_SHARES;
                  return (
                    <tr key={h.memberNo} className="transition hover:bg-[#f2ead6]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="text-sm font-medium text-[#1c2b22]">{h.name}</div>
                        <a
                          href={`/members/${h.memberNo}`}
                          className="text-xs text-[#8a6a1f] underline decoration-[#c9a24b] decoration-1 underline-offset-2 hover:text-[#c9a24b]"
                        >
                          {h.memberNo}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-[IBM_Plex_Mono] text-sm text-[#4a5a4c]">
                        {h.certificateNo}
                      </td>
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
                {rows.length === 0 && (
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
          Showing {rows.length} of {MOCK_HOLDINGS.length} members · Avg. holding {totals.avgShares} shares
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "warn";
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
        {value}
      </p>
    </div>
  );
}