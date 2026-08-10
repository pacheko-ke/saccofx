"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Loan {
  loan_id: string;
  loan_account_number: string;
  member_id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  id_number: string;
  phone_primary: string;
  product_name: string;
  principal_amount: string;
  outstanding_principal: string;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = ["all", "pending", "disbursed", "closed", "written_off"];
const PAGE_SIZE = 20;

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/loans");
        if (!res.ok) throw new Error("Failed to load loans");
        const data = await res.json();
        const flatLoans = Array.isArray(data.loans[0]) ? data.loans.flat() : data.loans;
setLoans(data.loans);
        // console.log(data.loans);
        // setLoans(data.loans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return loans.filter((l) => {
      const matchesStatus = status === "all" || l.status === status;
      if (!matchesStatus) return false;

      if (!q) return true;
      // console.log(l.status)

      const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
      return (
        l.loan_account_number.toLowerCase().includes(q) ||
        l.member_number.toLowerCase().includes(q) ||
        l.product_name.toLowerCase().includes(q) ||
        l.first_name.toLowerCase().includes(q) ||
        l.last_name.toLowerCase().includes(q) ||
        fullName.includes(q) ||
        l.phone_primary.toLowerCase().includes(q) ||
        l.id_number.toLowerCase().includes(q)
      );
    });
  }, [loans, search, status]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-2 mt-10 flex flex-col gap-4 md:mx-20 mb-4">
      <Link
        href="/dashboard/add-members"
        className="text-white bg-orange-400 px-4 py-2 rounded-md self-end"
      >
        Loan Application
      </Link>
      <h1 className="text-xl font-semibold mb-4">Loans</h1>

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
              <th className="px-4 py-2">App. No</th>
              <th className="px-4 py-2">Applicant</th>
              <th className="px-4 py-2">Applicant ID</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Loan Amount</th>
              <th className="px-4 py-2">Outstanding</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No Loans found
                </td>
              </tr>
            ) : (
              paginated.map((l) => (
                
                <tr key={l.loan_id} className="border-t">
                  <td className="px-4 py-2">{l.loan_account_number}</td>
                  <td className="px-4 py-2">
                    {l.first_name} {l.last_name}
                  </td>
                  <td className="px-4 py-2">{l.id_number}</td>
                  <td className="px-4 py-2">{l.product_name}</td>
                  <td className="px-4 py-2">
                    KES {Number(l.principal_amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    KES {Number(l.outstanding_principal).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 capitalize">{l.status}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/loans/${l.loan_id}`}
                      className="text-emerald-800 hover:underline"
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

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-500">
          {filtered.length} loan{filtered.length !== 1 ? "s" : ""} · Page {page} of{" "}
          {totalPages}
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