// lib/loan-repayment/allocate.ts
//
// FIFO allocation order: penalty -> interest -> principal.
// Pure function so it can be reused for both the live preview (client)
// and the authoritative allocation at write-time (server action).

import type { FifoAllocationResult, LoanRepaymentContext } from "@/types/loan-repayment";

export function allocateRepayment(
  amount: number,
  loan: Pick<
    LoanRepaymentContext,
    "penaltyOutstanding" | "interestOutstanding" | "principalOutstanding"
  >
): FifoAllocationResult {
  let remaining = round2(Math.max(0, amount));

  const buckets = [
    { bucket: "PENALTY" as const, label: "Penalties", due: loan.penaltyOutstanding },
    { bucket: "INTEREST" as const, label: "Interest", due: loan.interestOutstanding },
    { bucket: "PRINCIPAL" as const, label: "Principal", due: loan.principalOutstanding },
  ];

  const lines = buckets.map(({ bucket, label, due }) => {
    const dueRounded = round2(Math.max(0, due));
    const applied = round2(Math.min(dueRounded, remaining));
    remaining = round2(remaining - applied);
    return {
      bucket,
      label,
      due: dueRounded,
      applied,
      remainingAfter: round2(dueRounded - applied),
    };
  });

  const totalApplied = round2(
    lines.reduce((sum, line) => sum + line.applied, 0)
  );

  return {
    lines,
    totalApplied,
    overpayment: round2(remaining), // left over after principal is cleared
    fullySettled: lines.every((l) => l.remainingAfter === 0),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}