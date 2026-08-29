"use client";

import Sidebar from "@/app/components/SideBar";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  idNumber: string;
  member_id: string;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = ["all", "active", "inactive", "pending", "suspended"];
const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  active: "bg-[#e4efe6] text-[#1c2b22]",
  pending: "bg-[#f3e6c8] text-[#7a5c1e]",
  inactive: "bg-[#e2ddd0] text-[#4a5c50]",
  suspended: "bg-[#f4dede] text-[#8a2c2c]",
};

export default function MembersPage() {
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch full member list once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/members");
        if (!res.ok) throw new Error("Failed to load members");
        const data = await res.json();
        setAllMembers(data.members);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter entirely client-side
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allMembers.filter((m) => {
      const matchesStatus = status === "all" || m.status === status;
      if (!matchesStatus) return false;

      if (!q) return true;

      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
      return (
        m.memberNumber.toLowerCase().includes(q) ||
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        fullName.includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.idNumber.toLowerCase().includes(q)
      );
    });
  }, [allMembers, search, status]);

  // Reset to page 1 whenever the filters change
  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
    <Sidebar></Sidebar>
    <div className="min-h-screen bg-[#eee7d6] md:px-10">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-[#1c2b22]">Members</h1>
            <p className="mt-1 text-sm text-[#4a5c50]">Register of all SACCO members.</p>
          </div>
          <Link
            href="/portal/admin/members/add"
            className="inline-flex items-center justify-center rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c]"
          >
            + Add member
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search by name, phone, member no., ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-[#c9a24b]/40 bg-[#faf6ec] px-3 py-2 text-sm capitalize text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[#f4dede] px-4 py-2 text-sm text-[#8a2c2c]">{error}</div>
        )}

        {/* Ledger table */}
        <div className="overflow-x-auto rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60 text-left">
              <tr>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Member No.</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Name</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Phone</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">ID number</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Status</th>
                <th className="px-4 py-3 font-serif font-medium text-[#1c2b22]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c9a24b]/15">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#9aa79f]">
                    Loading members...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#9aa79f]">
                    No members found
                  </td>
                </tr>
              ) : (
                paginated.map((m) => (
                  <tr key={m.id} className="hover:bg-[#eee7d6]/40">
                    <td className="px-4 py-3 font-mono text-xs text-[#4a5c50]">{m.memberNumber}</td>
                    <td className="px-4 py-3 text-[#1c2b22]">
                      {m.firstName} {m.lastName}
                    </td>
                    <td className="px-4 py-3 text-[#4a5c50]">{m.phone}</td>
                    <td className="px-4 py-3 text-[#4a5c50]">{m.idNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[m.status] ?? "bg-[#e2ddd0] text-[#4a5c50]"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/portal/admin/members/${m.member_id}`}
                        className="font-medium text-[#1c2b22] underline decoration-[#c9a24b] decoration-2 underline-offset-2 hover:text-[#233a2c]"
                      >
                        View
                      </Link>
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
            {filtered.length} member{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
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
    </div>
    </>
  );
}