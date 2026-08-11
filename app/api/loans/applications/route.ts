import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

interface GuarantorInput {
  fullName: string;
  phone: string;
  nationalId: string;
  relationship: string;
  guaranteedAmount: number;
  verified: boolean; // must be true — set once OTP is confirmed client-side
}

interface LoanApplicationInput {
  memberId: string;
  loanProductId: string;
  amountRequested: number;
  termMonths: number;
  purpose: string;
  guarantors: GuarantorInput[];
  applicantOtpVerified: boolean; // gate: must be true before we touch the DB
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoanApplicationInput;

    // --- Guard rails: never persist an application that skipped OTP steps ---
    if (!body.applicantOtpVerified) {
      return NextResponse.json(
        { error: "Applicant identity has not been confirmed via OTP." },
        { status: 400 }
      );
    }
    if (!body.guarantors || body.guarantors.length === 0) {
      return NextResponse.json({ error: "At least one guarantor is required." }, { status: 400 });
    }
    if (body.guarantors.length > 5) {
      return NextResponse.json({ error: "A maximum of 5 guarantors is allowed." }, { status: 400 });
    }
    if (body.guarantors.some((g) => !g.verified)) {
      return NextResponse.json(
        { error: "All guarantors must be phone-verified via OTP before submission." },
        { status: 400 }
      );
    }

    // --- Insert loan application (adjust column names to match your schema) ---
    const [application] = await sql`
      INSERT INTO loan_applications (
        member_id,
        loan_product_id,
        amount_requested,
        term_months,
        purpose,
        status,
        created_at
      ) VALUES (
        ${body.memberId},
        ${body.loanProductId},
        ${body.amountRequested},
        ${body.termMonths},
        ${body.purpose},
        'PENDING_COMMITTEE_REVIEW',
        now()
      )
      RETURNING id, status, created_at
    `;

    // --- Insert guarantors tied to the application ---
    for (const g of body.guarantors) {
      await sql`
        INSERT INTO loan_guarantors (
          loan_application_id,
          full_name,
          phone,
          national_id,
          relationship,
          guaranteed_amount,
          otp_verified_at
        ) VALUES (
          ${application.id},
          ${g.fullName},
          ${g.phone},
          ${g.nationalId},
          ${g.relationship},
          ${g.guaranteedAmount},
          now()
        )
      `;
    }

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (err) {
    console.error("Loan application submission error:", err);
    return NextResponse.json({ error: "Failed to submit loan application" }, { status: 500 });
  }
}
