"use client";

import { useEffect, useRef, useState } from "react";

interface MemberSearchResult {
  member_id: string;

  member_number: string;
  firstName: string;
  lastName: string;
  idNumber: string;
}

interface SavingsProduct {
  savings_product_id: string;
  product_name: string;
  minOpeningBalance?: string | number;
}

interface AddSavingsAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddSavingsAccountModal({
  isOpen,
  onClose,
  onSuccess,
}: AddSavingsAccountModalProps) {
  // Member search
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Products
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [productId, setProductId] = useState("");

  // Form
  const [initialDeposit, setInitialDeposit] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset everything whenever the modal is closed
  useEffect(() => {
    if (!isOpen) {
      setMemberQuery("");
      setMemberResults([]);
      setSelectedMember(null);
      setProductId("");
      setInitialDeposit("");
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Load savings products once the modal opens
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch("/api/v1/savings/products");
        if (!res.ok) return;
const data = await res.json();
setProducts(data ?? data ?? []);
      } catch {
        // Non-fatal: fall back to manual product entry if this fails
      }
    })();
  }, [isOpen]);

  // Debounced member search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!memberQuery.trim() || selectedMember) {
      setMemberResults([]);
      return;
    }

        debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
            const res = await fetch(
            `/api/v1/members/search?q=${encodeURIComponent(memberQuery.trim())}`
            );
            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setMemberResults(data.members ?? []);
        } catch {
            setMemberResults([]);
        } finally {
            setSearching(false);
        }
        }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [memberQuery, selectedMember]);

  const handleSelectMember = (m: MemberSearchResult) => {
    setSelectedMember(m);
    setMemberQuery(`${m.firstName} ${m.lastName}`);
    setMemberResults([]);
  };

  const handleChangeMember = () => {
    setSelectedMember(null);
    setMemberQuery("");
  };

  const canSubmit =
    !!selectedMember && !!productId && initialDeposit.trim() !== "" && !submitting;

  const handleSubmit = async () => {
    if (!selectedMember || !productId) {
      setError("Please select a member and a savings product.");
      return;
    }
    const depositValue = Number(initialDeposit);
    if (Number.isNaN(depositValue) || depositValue < 0) {
      setError("Enter a valid opening deposit amount.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/savings/accounts/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember.member_id,
          productId:productId,
          initialDeposit: depositValue,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to open account");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;
 

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2b22]/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[#c9a24b]/30 bg-[#faf6ec] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#c9a24b]/30 px-6 py-4">
          <h2 className="font-serif text-lg text-[#1c2b22]">Open Savings Account</h2>
          <button
            onClick={onClose}
            className="text-[#4a5c50] hover:text-[#1c2b22]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-md bg-[#f4dede] px-3 py-2 text-sm text-[#8a2c2c]">
              {error}
            </div>
          )}

          {/* Member search */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1c2b22]">Member</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, member no., or ID..."
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                disabled={!!selectedMember}
                className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22] disabled:bg-[#eee7d6]"
              />
              {selectedMember && (
                <button
                  onClick={handleChangeMember}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-[#8a2c2c] hover:underline"
                >
                  Change
                </button>
              )}

              {!selectedMember && (searching || memberResults.length > 0) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-[#c9a24b]/30 bg-white shadow-md">
                  {searching ? (
                    <div className="px-3 py-2 text-sm text-[#9aa79f]">Searching...</div>
                  ) : (
                    memberResults.map((m) => (
                      <button
                        key={m.member_id}
                        onClick={() => handleSelectMember(m)}
                        className="block w-full px-3 py-2 text-left text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
                      >
                        <span className="font-medium">
                          {m.firstName} {m.lastName}
                        </span>
                        <span className="ml-2 font-mono text-xs text-[#4a5c50]">
                          {m.member_number}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Product */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1c2b22]">
              Savings Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.savings_product_id} value={p.savings_product_id}>
                  {p.product_name}
                  
                </option>

              ))}
            </select>
          </div>

          {/* Opening deposit */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1c2b22]">
              Opening Deposit (KES)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0.00"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              className="w-full rounded-md border border-[#c9a24b]/40 bg-white px-3 py-2 text-sm text-[#1c2b22] placeholder:text-[#9aa79f] focus:border-[#1c2b22] focus:outline-none focus:ring-1 focus:ring-[#1c2b22]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#c9a24b]/30 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-[#c9a24b]/40 px-4 py-2 text-sm text-[#1c2b22] hover:bg-[#eee7d6]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-[#1c2b22] px-4 py-2 text-sm font-medium text-[#faf6ec] hover:bg-[#233a2c] disabled:opacity-40"
          >
            {submitting ? "Opening..." : "Open Account"}
          </button>
        </div>
      </div>
    </div>
  );
}