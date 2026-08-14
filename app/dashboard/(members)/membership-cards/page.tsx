"use client";

import { useEffect, useMemo, useState } from "react";

// CR80 card size: 85.60mm x 53.98mm (standard ID/credit card)
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 53.98;

interface Member {
  id: string;
  memberNo: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  phone: string | null;
  photoUrl: string | null;
  joinDate: string;
  status: string;
  branchName: string | null;
}

export default function MemberCardsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<"front" | "back" | "both">("both");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/members/cards?status=active");
        const data = await res.json();
        if (!cancelled) setMembers(data.members ?? []);
      } catch (err) {
        console.error("Failed to load members", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filtering, per established preference: fetch once, filter in-memory
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.memberNo, m.firstName, m.lastName, m.nationalId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [members, search]);

  const selectedMembers = useMemo(
    () => members.filter((m) => selected.has(m.memberNo)),
    [members, selected]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = filtered.every((m) => next.has(m.memberNo));
      filtered.forEach((m) => {
        if (allSelected) next.delete(m.memberNo);
        else next.add(m.memberNo);
      });
      return next;
    });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function initials(m: Member) {
    return `${m.firstName?.[0] ?? ""}${m.lastName?.[0] ?? ""}`.toUpperCase();
  }

  return (
    <div className="min-h-screen bg-[#faf6ec] ">
      {/* Screen-only controls */}
      <div className="print:hidden">
        <header className="border-b border-[#c9a24b]/30 bg-[#1c2b22] px-20 py-5">
          <h1 className="font-serif text-2xl text-[#faf6ec]">
            Membership Card Printing
          </h1>
          <p className="mt-1 text-sm text-[#eee7d6]/80">
            Select members and print CR80-size cards (85.6mm × 53.98mm)
          </p>
        </header>

        <div className="mx-auto max-w-6xl px-2 py-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, member no, or national ID..."
              className="flex-1 min-w-[240px] rounded-md border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#1c2b22]/40 focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
            />

            <select
              value={side}
              onChange={(e) => setSide(e.target.value as typeof side)}
              className="rounded-md border border-[#1c2b22]/20 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none"
            >
              <option value="both">Front &amp; Back</option>
              <option value="front">Front only</option>
              <option value="back">Back only</option>
            </select>

            <button
              onClick={toggleAllFiltered}
              className="rounded-md border border-[#1c2b22]/20 bg-white px-4 py-2 text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
            >
              {filtered.length > 0 && filtered.every((m) => selected.has(m.memberNo))
                ? "Deselect all"
                : "Select all"}
            </button>

            <button
              disabled={selected.size === 0}
              onClick={() => window.print()}
              className="rounded-md bg-[#c9a24b] px-4 py-2 text-sm font-medium text-[#1c2b22] hover:bg-[#b8913f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Print {selected.size > 0 ? `(${selected.size})` : ""} Card
              {selected.size === 1 ? "" : "s"}
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-[#1c2b22]/60">Loading members...</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#1c2b22]/10 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-[#eee7d6] text-left text-[#1c2b22]">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 font-serif">Member No.</th>
                    <th className="px-3 py-2 font-serif">Name</th>
                    <th className="px-3 py-2 font-serif">Branch</th>
                    <th className="px-3 py-2 font-serif">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr
                      key={m.memberNo}
                      className="cursor-pointer border-t border-[#1c2b22]/5 hover:bg-[#faf6ec]"
                      onClick={() => toggle(m.memberNo)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(m.memberNo)}
                          onChange={() => toggle(m.memberNo)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[#c9a24b]"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-[#1c2b22]/80">
                        {m.memberNo}
                      </td>
                      <td className="px-3 py-2 text-[#1c2b22]">
                        {m.firstName} {m.lastName}
                      </td>
                      <td className="px-3 py-2 text-[#1c2b22]/70">
                        {m.branchName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[#1c2b22]/70">
                        {formatDate(m.joinDate)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[#1c2b22]/50">
                        No members match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Print-only card sheet */}
      <div className="hidden print:block">
        <div className="card-sheet">
          {selectedMembers.map((m) => (
            <div key={m.memberNo} className="card-pair">
              {(side === "front" || side === "both") && (
                <div className="card card-front">
                  <div className="card-header">
                    <span className="card-org">SACCOFX PRO</span>
                    <span className="card-org-sub">Member Identification</span>
                  </div>
                  <div className="card-body">
                    <div className="card-photo">
                      {m.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photoUrl} alt="" />
                      ) : (
                        <span>{initials(m)}</span>
                      )}
                    </div>
                    <div className="card-details">
                      <div className="card-name">
                        {m.firstName} {m.lastName}
                      </div>
                      <div className="card-row">
                        <span className="card-label">No.</span>
                        <span className="card-value">{m.memberNo}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">ID</span>
                        <span className="card-value">
                          {m.nationalId ?? "—"}
                        </span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Branch</span>
                        <span className="card-value">
                          {m.branchName ?? "—"}
                        </span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Joined</span>
                        <span className="card-value">
                          {formatDate(m.joinDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <span>SASRA Regulated</span>
                  </div>
                </div>
              )}

              {(side === "back" || side === "both") && (
                <div className="card card-back">
                  <div className="card-back-strip" />
                  <div className="card-back-body">
                    <div className="card-barcode-pattern" />
                    <div className="card-barcode-number">{m.memberNo}</div>
                    <p className="card-terms">
                      This card is the property of SaccoFX Pro and remains
                      valid while membership is active. If found, please
                      return to the nearest branch. Lost cards should be
                      reported immediately to prevent unauthorized use.
                    </p>
                    <div className="card-signature">
                      <span>Authorized Signature</span>
                    </div>
                  </div>
                  <div className="card-footer card-footer-back">
                    <span>www.saccofxpro.co.ke</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            background: white !important;
          }

          .card-sheet {
            display: flex;
            flex-wrap: wrap;
            gap: 5mm;
          }

          .card-pair {
            display: flex;
            gap: 5mm;
            page-break-inside: avoid;
          }

          .card {
            width: ${CARD_WIDTH_MM}mm;
            height: ${CARD_HEIGHT_MM}mm;
            border-radius: 3mm;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            font-family: Georgia, "Times New Roman", serif;
            box-shadow: 0 0 0 0.3mm rgba(28, 43, 34, 0.2);
          }

          .card-front {
            background: linear-gradient(155deg, #faf6ec 0%, #eee7d6 100%);
            color: #1c2b22;
          }

          .card-header {
            background: #1c2b22;
            color: #faf6ec;
            padding: 2mm 3mm;
            display: flex;
            flex-direction: column;
            line-height: 1.1;
          }

          .card-org {
            font-size: 9pt;
            font-weight: bold;
            letter-spacing: 0.5pt;
          }

          .card-org-sub {
            font-size: 5.5pt;
            color: #c9a24b;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
          }

          .card-body {
            flex: 1;
            display: flex;
            gap: 2.5mm;
            padding: 2.5mm 3mm;
          }

          .card-photo {
            width: 16mm;
            height: 20mm;
            flex-shrink: 0;
            background: #eee7d6;
            border: 0.3mm solid #c9a24b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10pt;
            font-weight: bold;
            color: #1c2b22;
            overflow: hidden;
          }

          .card-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .card-details {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 0.6mm;
          }

          .card-name {
            font-size: 8.5pt;
            font-weight: bold;
            margin-bottom: 0.8mm;
          }

          .card-row {
            display: flex;
            font-size: 6pt;
            gap: 1.5mm;
          }

          .card-label {
            width: 10mm;
            color: #1c2b22;
            opacity: 0.6;
            text-transform: uppercase;
          }

          .card-value {
            font-weight: 600;
          }

          .card-footer {
            background: #c9a24b;
            color: #1c2b22;
            font-size: 5pt;
            text-align: center;
            padding: 0.8mm;
            letter-spacing: 0.5pt;
            text-transform: uppercase;
          }

          .card-back {
            background: #faf6ec;
            color: #1c2b22;
          }

          .card-back-strip {
            height: 8mm;
            background: #1c2b22;
            margin-top: 3mm;
          }

          .card-back-body {
            flex: 1;
            padding: 2.5mm 3mm;
            display: flex;
            flex-direction: column;
            gap: 2mm;
          }

          .card-barcode-pattern {
            align-self: flex-start;
            width: 100%;
            height: 8mm;
            background: repeating-linear-gradient(
              90deg,
              #1c2b22 0,
              #1c2b22 0.4mm,
              transparent 0.4mm,
              transparent 0.9mm
            );
          }

          .card-barcode-number {
            font-size: 6pt;
            font-family: "Courier New", monospace;
            letter-spacing: 1.5pt;
            text-align: center;
          }

          .card-terms {
            font-size: 4.8pt;
            line-height: 1.4;
            color: #1c2b22;
            opacity: 0.75;
          }

          .card-signature {
            margin-top: auto;
            border-top: 0.2mm solid #1c2b22;
            padding-top: 1mm;
            font-size: 5pt;
            opacity: 0.6;
          }

          .card-footer-back {
            background: transparent;
            color: #1c2b22;
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}