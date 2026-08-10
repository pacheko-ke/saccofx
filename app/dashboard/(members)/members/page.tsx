"use client";

import { useEffect, useState, useTransition } from "react";

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

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounce search input so we don't hit the API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 whenever status filter changes
  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
          search: debouncedSearch,
          status,
        });
        const res = await fetch(`/api/members?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load members");
        const data = await res.json();
        setMembers(data.members);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }, [page, debouncedSearch, status]);

  return (
    <div className="p-6">
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
            </tr>
          </thead>
          <tbody>
            {isPending && members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No members found
                </td>
              </tr>
            ) : (
              members.map((m) => (
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
          {total} member{total !== 1 ? "s" : ""} · Page {page} of{" "}
          {Math.max(1, Math.ceil(total / 20))}
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
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}