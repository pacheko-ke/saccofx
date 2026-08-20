"use client";

import { useEffect, useMemo, useState } from "react";

type AccountType = "savings" | "shares" | "loan";

interface MemberAccount {
  id: string;
  account_type: AccountType;
  account_number: string;
  status: string;
  opened_at: string;
}

type PresetRange = "30d" | "90d" | "6m" | "1y" | "ytd" | "custom";

const ACCOUNT_LABELS: Record<AccountType, string> = {
  savings: "Savings",
  shares: "Share Capital",
  loan: "Loan",
};

const PRESETS: { value: PresetRange; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeRange(preset: PresetRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    case "6m":
      start.setMonth(end.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(end.getFullYear() - 1);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
    default:
      break;
  }

  return { start: toISODate(start), end: toISODate(end) };
}

export default function MemberStatementsPage() {
  const [accounts, setAccounts] = useState<MemberAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [preset, setPreset] = useState<PresetRange>("90d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setLoadingAccounts(true);
      setLoadError("");
      try {
        const res = await fetch("/api/v1/members/statement");
        if (!res.ok) throw new Error("Failed to load your accounts");
        const data = await res.json();
        if (!cancelled) {
          setAccounts(data.accounts ?? []);
          if (data.accounts?.length > 0) setSelectedAccountId(data.accounts[0].id);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveRange = useMemo(() => {
    if (preset === "custom") return { start: customStart, end: customEnd };
    return computeRange(preset);
  }, [preset, customStart, customEnd]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const rangeValid =
    effectiveRange.start && effectiveRange.end && effectiveRange.start <= effectiveRange.end;

  async function handleGenerate() {
    if (!selectedAccountId || !rangeValid) return;

    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/v1/members/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          startDate: effectiveRange.start,
          endDate: effectiveRange.end,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to generate statement");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${selectedAccount?.account_number ?? "account"}-${effectiveRange.start}-to-${effectiveRange.end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-4 mt-14 overflow-hidden rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec]">
      <div className="border-b border-[#c9a24b]/30 px-6 py-5 sm:px-8">
        <h1 className="font-serif text-xl text-[#1c2b22] sm:text-2xl">Account statements</h1>
        <p className="mt-1 text-sm text-[#4a5c50]">
          Generate a PDF statement for any of your accounts over a chosen period.
        </p>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {loadingAccounts ? (
          <p className="text-sm text-[#4a5c50]">Loading your accounts…</p>
        ) : loadError ? (
          <p className="rounded-md bg-[#f4dede] px-3 py-2 text-sm text-[#8a2c2c]">{loadError}</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-[#4a5c50]">You don't have any accounts eligible for statements yet.</p>
        ) : (
          <div className="space-y-6">
            {/* Account selector */}
            <div>
              <p className="mb-2 text-[13px] font-medium text-[#4a5c50]">Select account</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`rounded-md border px-4 py-3 text-left transition-colors ${
                      selectedAccountId === acc.id
                        ? "border-[#1c2b22] bg-[#e4efe6]"
                        : "border-[#c9a24b]/40 bg-white hover:bg-[#eee7d6]"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7a5c1e]">
                      {ACCOUNT_LABELS[acc.account_type]}
                    </p>
                    <p className="mt-1 font-mono text-sm text-[#1c2b22]">{acc.account_number}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Period selector */}
            <div>
              <p className="mb-2 text-[13px] font-medium text-[#4a5c50]">Statement period</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPreset(p.value)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      preset === p.value
                        ? "border-[#1c2b22] bg-[#1c2b22] text-[#faf6ec]"
                        : "border-[#c9a24b]/40 bg-white text-[#4a5c50] hover:bg-[#eee7d6]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {preset === "custom" && (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#4a5c50]">From</label>
                    <input
                      type="date"
                      value={customStart}
                      max={toISODate(new Date())}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3.5 py-2.5 text-[15px] text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#1c2b22]/15"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#4a5c50]">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      max={toISODate(new Date())}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3.5 py-2.5 text-[15px] text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-2 focus:ring-[#1c2b22]/15"
                    />
                  </div>
                </div>
              )}

              {!rangeValid && preset === "custom" && (customStart || customEnd) && (
                <p className="mt-2 text-xs text-red-600">Choose a valid start and end date.</p>
              )}
            </div>

            {genError && <p className="rounded-md bg-[#f4dede] px-3 py-2 text-sm text-[#8a2c2c]">{genError}</p>}

            <div className="flex items-center gap-3 border-t border-[#c9a24b]/30 pt-5">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!selectedAccountId || !rangeValid || generating}
                className="rounded-md bg-[#1c2b22] px-5 py-2.5 text-sm font-medium text-[#faf6ec] transition-colors hover:bg-[#233a2c] disabled:opacity-50"
              >
                {generating ? "Generating…" : "Download PDF statement"}
              </button>
              {selectedAccount && rangeValid && (
                <span className="text-xs text-[#4a5c50]">
                  {ACCOUNT_LABELS[selectedAccount.account_type]} · {effectiveRange.start} to {effectiveRange.end}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}