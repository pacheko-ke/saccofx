// app/reports/loan-portfolio/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface LoanPortfolioRecord {
  id: string;
  loanNumber: string;
  memberNumber: string;
  memberName: string;
  productName: string;
  productCode: string;
  disbursedAmount: number;
  coa1200Principal: number; // Asset: Loan Principal
  coa1210Interest: number;  // Asset: Interest Receivable
  coa1220Penalties: number; // Asset: Penalty Receivable
  daysInArrears: number;
  maturityDate: string;
  lastVoucherRef: string;
}

const PRODUCT_OPTIONS = ["all", "DEV-01", "EMG-02", "AST-01"];
const CLASSIFICATION_OPTIONS = ["all", "performing", "watch", "non_performing"];
const PAGE_SIZE = 20;

const CLASSIFICATION_STYLES: Record<string, string> = {
  performing: "bg-[#e4efe6] text-[#1c2b22]",
  watch: "bg-[#f3e6c8] text-[#7a5c1e]",
  substandard: "bg-[#f4dede] text-[#8a2c2c]",
  doubtful: "bg-[#e2ddd0] text-[#4a5c50]",
  loss: "bg-[#f4dede] font-semibold text-[#8a2c2c]",
};

export default function LoanPortfolioPage() {
  const [loans, setLoans] = useState<LoanPortfolioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("all");
  const [classification, setClassification] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch portfolio ledger on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/reports/loan-portfolio");
        if (!res.ok) throw new Error("Failed to load loan portfolio ledger");
        const data = await res.json();
        setLoans(data.loans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // SASRA Risk Category Label Helper
  const getSasraClassification = (days: number): { label: string; key: string } => {
    if (days <= 30) return { label: "Performing (1%)", key: "performing" };
    if (days <= 90) return { label: "Watch (5%)", key: "watch" };
    if (days <= 180) return { label: "Substandard (25%)", key: "substandard" };
    if (days <= 360) return { label: "Doubtful (50%)", key: "doubtful" };
    return { label: "Loss (100%)", key: "loss" };
  };

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return loans.filter((l) => {
      const matchesProduct = product === "all" || l.productCode === product;

      let matchesClass = true;
      if (classification === "performing") matchesClass = l.daysInArrears <= 30;
      if (classification === "watch") matchesClass = l.daysInArrears > 30 && l.daysInArrears <= 90;
      if (classification === "non_performing") matchesClass = l.daysInArrears > 90;

      if (!matchesProduct || !matchesClass) return false;

      if (!q) return true;

      return (
        l.loanNumber.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q) ||
        l.memberNumber.toLowerCase().includes(q) ||
        l.lastVoucherRef.toLowerCase().includes(q)
      );
    });
  }, [loans, search, product, classification]);

  // Reset page on filter mutation
  useEffect(() => {
    setPage(1);
  }, [search, product, classification]);

  // Aggregate metrics mapped to General Ledger COAs
  const stats = useMemo(() => {
    return filtered.reduce(
      (acc, l) => {
        acc.totalDisbursed += l.disbursedAmount;
        acc.principalCOA1200 += l.coa1200Principal;
        acc.receivablesTotal += l.coa1210Interest + l.coa1220Penalties;
        if (l.daysInArrears > 30) acc.par30Exposure += l.coa1200Principal;
        return acc;
      },
      { totalDisbursed: 0, principalCOA1200: 0, receivablesTotal: 0, par30Exposure: 0 }
    );
  }, [filtered]);

  const parRatio = stats.principalCOA1200 > 0 
    ? ((stats.par30Exposure / stats.principalCOA1200) * 100).toFixed(2) 
    : "0.00";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(val);

  return (
<>

</>
  );
}