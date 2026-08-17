// types/loan-repayment.ts

export type PaymentMethod = "MPESA" | "CASH" | "CHEQUE";

export type ParBucket =
  | "CURRENT"
  | "PAR_1_30"
  | "PAR_31_60"
  | "PAR_61_90"
  | "PAR_91_180"
  | "PAR_180_PLUS";

export interface LoanSearchResult {
  loanId: string;
  loanNumber: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  productName: string;
  outstandingBalance: number;
  parBucket: ParBucket;
  daysInArrears: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
}

export interface LoanRepaymentContext {
  loanId: string;
  loanNumber: string;
  memberName: string;
  memberNumber: string;
  productName: string;
  principalOutstanding: number;
  interestOutstanding: number;
  penaltyOutstanding: number;
  totalOutstanding: number;
  parBucket: ParBucket;
  daysInArrears: number;
  disbursedAmount: number;
  disbursedDate: string;
  nextDueDate: string | null;
}

export interface FifoAllocationLine {
  bucket: "PENALTY" | "INTEREST" | "PRINCIPAL";
  label: string;
  due: number;
  applied: number;
  remainingAfter: number;
}

export interface FifoAllocationResult {
  lines: FifoAllocationLine[];
  totalApplied: number;
  overpayment: number;
  fullySettled: boolean;
}

export interface RepaymentSubmission {
  loanId: string;
  amount: number;
  method: PaymentMethod;
  reference: string; // M-Pesa code, cheque number, or teller note
  paidAt: string; // ISO date
  notes?: string;
}

export interface RepaymentResult {
  success: boolean;
  receiptNumber?: string;
  allocation?: FifoAllocationResult;
  error?: string;
}