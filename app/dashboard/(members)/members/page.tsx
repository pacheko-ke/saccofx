"use client";

// import { Link } from "lucide-react";
import Link  from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  idNumber: string;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = ["all", "active", "inactive", "pending", "suspended"];
const PAGE_SIZE = 20;

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
        const res = await fetch("/api/members");
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
  const paginated = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div className="p-6 mt-10 flex flex-col gap-4">
      <Link href="/dashboard/add-member" className="text-white bg-orange-400 px-4 py-2 rounded-md self-end">Add Member</Link>
      <h1 className="text-xl font-semibold mb-4">Members</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, member no., ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-3 py-2 text-sm capitalize"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Member No.</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">ID Number</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No members found
                </td>
              </tr>
            ) : (
              paginated.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2">{m.memberNumber}</td>
                  <td className="px-4 py-2">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-4 py-2">{m.phone}</td>
                  <td className="px-4 py-2">{m.idNumber}</td>
                  <td className="px-4 py-2 capitalize">{m.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-500">
          {filtered.length} member{filtered.length !== 1 ? "s" : ""} · Page{" "}
          {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}