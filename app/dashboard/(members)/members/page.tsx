"use client";

import { useMemo, useState } from "react";

/**
 * Sacco members table with filters and pagination.
 * Drop into a Next.js project and replace `members` with data from Prisma:
 *   const members = await prisma.member.findMany();
 */

type Member = {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  shares: number;
  monthlyContribution: number;
  status: "active" | "pending" | "dormant";
};

const members: Member[] = [
  { id: "m_001", fullName: "Wanjiru Kamau", idNumber: "27884451", phone: "0712 345 678", shares: 40, monthlyContribution: 3000, status: "active" },
  { id: "m_002", fullName: "Otieno Onyango", idNumber: "24551029", phone: "0722 981 004", shares: 15, monthlyContribution: 1500, status: "pending" },
  { id: "m_003", fullName: "Baraka Traders Chama", idNumber: "31007742", phone: "0701 552 213", shares: 120, monthlyContribution: 12000, status: "active" },
  { id: "m_004", fullName: "Achieng Odhiambo", idNumber: "29981123", phone: "0733 220 981", shares: 8, monthlyContribution: 1000, status: "dormant" },
  { id: "m_005", fullName: "Kiptoo Sang", idNumber: "26674401", phone: "0745 667 812", shares: 60, monthlyContribution: 5000, status: "active" },
  { id: "m_006", fullName: "Nafula Wekesa", idNumber: "28871192", phone: "0788 213 447", shares: 22, monthlyContribution: 2200, status: "pending" },
  { id: "m_007", fullName: "Mutiso Kioko", idNumber: "25109834", phone: "0711 998 302", shares: 5, monthlyContribution: 800, status: "dormant" },
  { id: "m_008", fullName: "Chebet Rono", idNumber: "27502217", phone: "0700 445 118", shares: 90, monthlyContribution: 7500, status: "active" },
  { id: "m_009", fullName: "Riverside Boda Sacco Group", idNumber: "30887761", phone: "0722 004 559", shares: 200, monthlyContribution: 18000, status: "active" },
  { id: "m_010", fullName: "Njoroge Mwangi", idNumber: "24418825", phone: "0733 771 903", shares: 12, monthlyContribution: 1200, status: "pending" },
  { id: "m_011", fullName: "Aisha Mohammed", idNumber: "29004471", phone: "0704 552 810", shares: 35, monthlyContribution: 3500, status: "active" },
  { id: "m_012", fullName: "Kamande Njuguna", idNumber: "23387765", phone: "0712 664 291", shares: 3, monthlyContribution: 500, status: "dormant" },
];

const STATUS_STYLES: Record<Member["status"], string> = {
  active: "bg-emerald-50 text-emerald-800",
  pending: "bg-amber-50 text-amber-800",
  dormant: "bg-stone-100 text-stone-500",
};

const PAGE_SIZE = 5;

export default function MembersTable() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Member["status"] | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.idNumber.includes(q) ||
        m.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updateStatus(value: Member["status"] | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div className=" mt-10 ml-4 md:ml-20 ">
      {/* Filters */}
      <div className="flex flex-col gap-3   border-b border-stone-200 py-4 md:flex-row sm:items-center ">
        <input
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder="Search name, ID, phone"
          className=" rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 "
        />
        <select
          value={statusFilter}
          onChange={(e) => updateStatus(e.target.value as Member["status"] | "all")}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="dormant">Dormant</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <table className=" text-sm w-full ">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">ID number</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Shares</th>
            <th className="px-4 py-3 font-medium">Contribution</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {paged.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-3 font-medium text-stone-900">{m.fullName}</td>
              <td className="px-4 py-3 font-mono text-stone-600">{m.idNumber}</td>
              <td className="px-4 py-3 text-stone-700">{m.phone}</td>
              <td className="px-4 py-3 text-stone-700">{m.shares}</td>
              <td className="px-4 py-3 text-stone-700">
                KES {m.monthlyContribution.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[m.status]}`}>
                  {m.status}
                </span>
              </td>
            </tr>
          ))}

          {paged.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-400">
                No members match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
        <p className="text-xs text-stone-500">
          Page {currentPage} of {totalPages} · {filtered.length} member{filtered.length === 1 ? "" : "s"}
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
    </div>
  );
}