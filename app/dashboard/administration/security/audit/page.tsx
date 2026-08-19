"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Monitor,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  PlusCircle,
  Eye,
  Settings,
  AlertTriangle,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

type AuditOutcome = "success" | "failed" | "denied";

type AuditActionKind =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "view"
  | "config";

interface AuditEntry {
  id: string;
  timestamp: string; // ISO
  actorName: string;
  actorRole: string;
  action: string; // human-readable, e.g. "Approved loan LN-2026-00842"
  actionKind: AuditActionKind;
  entity: string; // e.g. "Loan Account" / "Member" / "SACCO Settings"
  ipAddress: string;
  outcome: AuditOutcome;
}

interface SecurityOverview {
  failedLogins24h: number;
  failedLoginsChangePct: number;
  activeSessions: number;
  adminActions7d: number;
  elevatedRoleUsers: number;
  lastExportAt: string | null;
}

interface AuditLogResponse {
  overview: SecurityOverview;
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_ICONS: Record<AuditActionKind, typeof LogIn> = {
  login: LogIn,
  logout: LogOut,
  create: PlusCircle,
  update: Pencil,
  delete: Trash2,
  view: Eye,
  config: Settings,
};

const OUTCOME_STYLE: Record<AuditOutcome, string> = {
  success: "bg-[#dfe9dd] text-[#1c2b22] border-[#5c7a5f]/50",
  failed: "bg-[#efd9d4] text-[#7a2e1c] border-[#b8543a]/50",
  denied: "bg-[#f3e6c4] text-[#7a5a12] border-[#c9a24b]/60",
};

const OUTCOME_LABEL: Record<AuditOutcome, string> = {
  success: "Success",
  failed: "Failed",
  denied: "Denied",
};

const ACTION_KIND_OPTIONS: { value: AuditActionKind | "all"; label: string }[] = [
  { value: "all", label: "All actions" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "view", label: "View" },
  { value: "config", label: "Config change" },
];

const OUTCOME_OPTIONS: { value: AuditOutcome | "all"; label: string }[] = [
  { value: "all", label: "All outcomes" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "denied", label: "Denied" },
];

const PAGE_SIZE = 20;

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function SecurityAuditPage() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [actionKind, setActionKind] = useState<AuditActionKind | "all">("all");
  const [outcome, setOutcome] = useState<AuditOutcome | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce free-text search input -> committed search term
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Reset to page 1 whenever a filter (other than search, handled above) changes
  useEffect(() => {
    setPage(1);
  }, [actionKind, outcome, dateFrom, dateTo]);

  const buildQuery = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));
      if (search) params.set("q", search);
      if (actionKind !== "all") params.set("actionKind", actionKind);
      if (outcome !== "all") params.set("outcome", outcome);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      return params.toString();
    },
    [search, actionKind, outcome, dateFrom, dateTo]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/security/audit-log?${buildQuery(page)}`);

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed with status ${res.status}`);
        }

        const json = (await res.json()) as AuditLogResponse;

        if (!cancelled) {
          setOverview(json.overview);
          setEntries(json.entries);
          setTotal(json.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load audit log");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [buildQuery, page]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/v1/security/audit-log/export?${buildQuery(1)}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saccofx-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't export the audit log. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilters =
    search !== "" || actionKind !== "all" || outcome !== "all" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setActionKind("all");
    setOutcome("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="w-full min-h-screen pt-4 mx-auto bg-[#faf6ec] font-sans text-[#1c2b22]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 border-b border-[#c9a24b]/40 pb-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c9a24b]">
            Compliance
          </p>
          <h1 className="font-serif text-3xl text-[#1c2b22]">Security &amp; Audit</h1>
          <p className="mt-1 text-sm text-[#1c2b22]/60">
            Every login, change, and access event across your SACCO, kept for SASRA review.
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-sm border border-[#b8543a]/40 bg-[#efd9d4]/50 px-4 py-3 text-sm text-[#7a2e1c]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Overview cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <OverviewCard
            icon={ShieldAlert}
            label="Failed Logins (24h)"
            value={overview ? String(overview.failedLogins24h) : "—"}
            tone={overview && overview.failedLogins24h > 0 ? "warn" : "neutral"}
            sub={
              overview
                ? `${overview.failedLoginsChangePct >= 0 ? "+" : ""}${overview.failedLoginsChangePct.toFixed(1)}% vs prior 24h`
                : undefined
            }
          />
          <OverviewCard
            icon={Monitor}
            label="Active Sessions"
            value={overview ? String(overview.activeSessions) : "—"}
            tone="neutral"
          />
          <OverviewCard
            icon={ShieldCheck}
            label="Admin Actions (7d)"
            value={overview ? String(overview.adminActions7d) : "—"}
            tone="neutral"
          />
          <OverviewCard
            icon={KeyRound}
            label="Elevated-Role Users"
            value={overview ? String(overview.elevatedRoleUsers) : "—"}
            tone="neutral"
            sub="Admin / Super Admin"
          />
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-sm border border-[#c9a24b]/30 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">
                Search
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1c2b22]/35"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="User, action, or entity…"
                  className="w-full rounded-md border border-[#1c2b22]/15 bg-white py-2 pl-8 pr-3 text-sm text-[#1c2b22] placeholder:text-[#1c2b22]/30 focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">
                Action
              </label>
              <select
                value={actionKind}
                onChange={(e) => setActionKind(e.target.value as AuditActionKind | "all")}
                className="rounded-md border border-[#1c2b22]/15 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              >
                {ACTION_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as AuditOutcome | "all")}
                className="rounded-md border border-[#1c2b22]/15 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              >
                {OUTCOME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-[#1c2b22]/15 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1c2b22]/55">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-[#1c2b22]/15 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#c9a24b] focus:outline-none focus:ring-1 focus:ring-[#c9a24b]"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-md px-3 py-2 text-xs font-medium text-[#1c2b22]/60 underline underline-offset-4 hover:text-[#1c2b22]"
              >
                Clear filters
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="ml-auto flex items-center gap-2 rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] transition-colors hover:bg-[#1c2b22]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={14} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Audit log table */}
        <div className="rounded-sm border border-[#c9a24b]/30 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#c9a24b]/30 bg-[#eee7d6]/60">
                  {["Timestamp", "User", "Action", "Entity", "IP Address", "Outcome"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-serif text-[13px] font-normal tracking-wide text-[#1c2b22]/70"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#1c2b22]/45">
                      Loading audit trail…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#1c2b22]/45">
                      {hasActiveFilters
                        ? "No events match these filters. Try widening the date range or clearing a filter."
                        : "No audit events recorded yet."}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const ActionIcon = ACTION_ICONS[entry.actionKind] ?? Eye;
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-[#c9a24b]/15 last:border-0 hover:bg-[#faf6ec]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-[#1c2b22]/60">
                          {formatTimestamp(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[#1c2b22]">{entry.actorName}</div>
                          <div className="text-[11px] text-[#1c2b22]/45">{entry.actorRole}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ActionIcon size={14} className="shrink-0 text-[#1c2b22]/40" />
                            <span className="text-[#1c2b22]">{entry.action}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#1c2b22]/70">{entry.entity}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-[#1c2b22]/55">
                          {entry.ipAddress}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${OUTCOME_STYLE[entry.outcome]}`}
                          >
                            {OUTCOME_LABEL[entry.outcome]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && entries.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#c9a24b]/20 px-4 py-3">
              <p className="text-xs text-[#1c2b22]/50">
                Showing{" "}
                <span className="font-mono">{(page - 1) * PAGE_SIZE + 1}</span>–
                <span className="font-mono">{Math.min(page * PAGE_SIZE, total)}</span> of{" "}
                <span className="font-mono">{total}</span> events
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded-md border border-[#1c2b22]/15 px-2.5 py-1.5 text-xs text-[#1c2b22]/70 hover:bg-[#eee7d6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="font-mono text-xs text-[#1c2b22]/60">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-md border border-[#1c2b22]/15 px-2.5 py-1.5 text-xs text-[#1c2b22]/70 hover:bg-[#eee7d6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {overview?.lastExportAt && (
          <p className="mt-4 text-center text-xs text-[#1c2b22]/40">
            Last exported {formatTimestamp(overview.lastExportAt)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Sub-components & helpers
   ──────────────────────────────────────────────────────────── */

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  sub?: string;
  tone: "neutral" | "warn";
}) {
  return (
    <div className="rounded-sm border border-[#c9a24b]/30 bg-[#eee7d6] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[#1c2b22]/55">{label}</span>
        <div
          className={`rounded-sm border p-1.5 ${
            tone === "warn"
              ? "border-[#b8543a]/40 bg-[#efd9d4]"
              : "border-[#c9a24b]/30 bg-[#faf6ec]"
          }`}
        >
          <Icon size={14} className={tone === "warn" ? "text-[#7a2e1c]" : "text-[#1c2b22]/60"} />
        </div>
      </div>
      <span className="font-mono text-xl leading-none text-[#1c2b22]">{value}</span>
      {sub && <p className="mt-1 text-[11px] text-[#1c2b22]/45">{sub}</p>}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}