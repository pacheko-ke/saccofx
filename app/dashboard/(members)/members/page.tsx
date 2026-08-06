"use client";

import { useMemo, useState } from "react";

/**
 * Sacco members table.
 *
 * Drop into a Next.js App Router project (e.g. app/members/page.tsx or
 * components/MembersTable.tsx). Tailwind CSS only, no extra dependencies.
 *
 * Replace `sampleMembers` with data fetched from your API/Prisma, e.g.:
 *   const members = await prisma.member.findMany({ orderBy: { createdAt: "desc" } });
 * and pass it in as a prop: <MembersTable members={members} />
 */

export type Member = {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email?: string;
  memberType: "individual" | "group";
  shares: number;
  monthlyContribution: number;
  status: "active" | "pending" | "dormant";
  joinedAt: string; // ISO date
};

const sampleMembers: Member[] = [
  {
    id: "m_001",
    fullName: "Wanjiru Kamau",
    idNumber: "27884451",
    phone: "0712 345 678",
    email: "wanjiru.k@example.com",
    memberType: "individual",
    shares: 40,
    monthlyContribution: 3000,
    status: "active",
    joinedAt: "2023-02-14",
  },
  {
    id: "m_002",
    fullName: "Otieno Onyango",
    idNumber: "24551029",
    phone: "0722 981 004",
    memberType: "individual",
    shares: 15,
    monthlyContribution: 1500,
    status: "pending",
    joinedAt: "2025-11-02",
  },
  {
    id: "m_003",
    fullName: "Baraka Traders Chama",
    idNumber: "31007742",
    phone: "0701 552 213",
    email: "baraka.chama@example.com",
    memberType: "group",
    shares: 120,
    monthlyContribution: 12000,
    status: "active",
    joinedAt: "2022-07-30",
  },
  {
    id: "m_004",
    fullName: "Achieng Odhiambo",
    idNumber: "29981123",
    phone: "0733 220 981",
    memberType: "individual",
    shares: 8,
    monthlyContribution: 1000,
    status: "dormant",
    joinedAt: "2021-05-19",
  },
  {
    id: "m_005",
    fullName: "Kiptoo Sang",
    idNumber: "26674401",
    phone: "0745 667 812",
    email: "kiptoo.sang@example.com",
    memberType: "individual",
    shares: 60,
    monthlyContribution: 5000,
    status: "active",
    joinedAt: "2024-01-08",
  },
];

const STATUS_STYLES: Record<Member["status"], string> = {
  active: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-800/20",
  pending: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-700/20",
  dormant: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-400/20",
};

const PAGE_SIZE = 10;

function formatKES(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

type SortKey = "fullName" | "shares" | "monthlyContribution" | "joinedAt";

export default function MembersTable({ members = sampleMembers }: { members?: Member[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Member["status"] | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("joinedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = members;

    if (statusFilter !== "all") {
      rows = rows.filter((m) => m.status === statusFilter);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.idNumber.includes(q) ||
          m.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      );
    }

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fullName") cmp = a.fullName.localeCompare(b.fullName);
      if (sortKey === "shares") cmp = a.shares - b.shares;
      if (sortKey === "monthlyContribution") cmp = a.monthlyContribution - b.monthlyContribution;
      if (sortKey === "joinedAt") cmp = a.joinedAt.localeCompare(b.joinedAt);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [members, query, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const totalShares = filtered.reduce((sum, m) => sum + m.shares, 0);
  const totalContribution = filtered.reduce((sum, m) => sum + m.monthlyContribution, 0);

  return (
    <div className=" mt-10 mx-auto w-full md:w-3/4 flex flex-col overflow-hidden rounded-lg  bg-white pl-10">
      <button className="self-end bg-green-600 px-10 rounded-md py-2 text-white">Add Member</button>
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-stone-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-800">
            Membership Register
          </p>
          <h2 className="mt-1 text-xl text-stone-900">
            Members{" "}
            <span className="s text-sm font-normal text-stone-400">
              ({filtered.length})
            </span>
          </h2>
        </div>

        <div className="flex flex-col md:flex-row pl-20 gap-3 sm:flex-row sm:items-center">
          <div className="relative self-start">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, ID, phone"
              className="w-3/4 rounded-md border border-stone-300 py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 sm:w-56"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Member["status"] | "all");
              setPage(1);
            }}
            className="rounded-md border border-stone-300 py-2 pl-3 pr-8 text-sm text-stone-700 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="dormant">Dormant</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="px-6 py-3 font-medium sm:px-8">
                <SortButton label="Member" active={sortKey === "fullName"} dir={sortDir} onClick={() => toggleSort("fullName")} />
              </th>
              <th className="px-4 py-3 font-medium">ID number</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">
                <SortButton label="Shares" active={sortKey === "shares"} dir={sortDir} onClick={() => toggleSort("shares")} />
              </th>
              <th className="px-4 py-3 font-medium">
                <SortButton
                  label="Monthly contribution"
                  active={sortKey === "monthlyContribution"}
                  dir={sortDir}
                  onClick={() => toggleSort("monthlyContribution")}
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <SortButton label="Joined" active={sortKey === "joinedAt"} dir={sortDir} onClick={() => toggleSort("joinedAt")} />
              </th>
              <th className="px-4 py-3 font-medium sm:px-8">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {paged.map((m) => (
              <tr key={m.id} className="hover:bg-stone-50/70">
                <td className="px-6 py-3.5 sm:px-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-[11px] font-semibold text-white">
                      {initials(m.fullName)}
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{m.fullName}</p>
                      <p className="text-xs capitalize text-stone-400">{m.memberType}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-[13px] text-stone-600">{m.idNumber}</td>
                <td className="px-4 py-3.5">
                  <p className="text-stone-700">{m.phone}</p>
                  {m.email && <p className="text-xs text-stone-400">{m.email}</p>}
                </td>
                <td className="px-4 py-3.5 tabular-nums text-stone-700">{m.shares}</td>
                <td className="px-4 py-3.5 tabular-nums text-stone-700">
                  {formatKES(m.monthlyContribution)}
                </td>
                <td className="px-4 py-3.5 text-stone-500">{formatDate(m.joinedAt)}</td>
                <td className="px-4 py-3.5 sm:px-8">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_STYLES[m.status]}`}
                  >
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}

            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-12 text-center text-sm text-stone-400">
                  No members match your search.
                </td>
              </tr>
            )}
          </tbody>
          {paged.length > 0 && (
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50 text-sm">
                <td className="px-6 py-3 font-medium text-stone-500 sm:px-8" colSpan={3}>
                  Totals ({filtered.length} member{filtered.length === 1 ? "" : "s"})
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-stone-800">{totalShares}</td>
                <td className="px-4 py-3 font-medium tabular-nums text-stone-800">
                  {formatKES(totalContribution)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4 sm:px-8">
          <p className="text-xs text-stone-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-stone-700 ${active ? "text-stone-700" : ""}`}
    >
      {label}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className={`transition-transform ${active && dir === "desc" ? "rotate-180" : ""} ${
          active ? "opacity-100" : "opacity-30"
        }`}
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}