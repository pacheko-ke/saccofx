import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import { verifyAuthToken } from "@/lib/auth"; // adjust path to wherever verifyAuthToken actually lives

// ---------------------------------------------------------------------------
// POST /api/loans/applications
//
// Creates a loan application together with its guarantors, inside a single
// transaction, after re-validating the loan product's minimum guarantor
// requirement server-side. No OTP step: instead, each guarantor who has a
// matching member/user account gets an in-app notification asking them to
// approve or decline guaranteeing the loan. The application sits in
// `pending_guarantor_approval` until every guarantor has responded, at which
// point a separate process (or a status-check route) should flip it to
// `pending_review` for the credit committee.
//
// ASSUMPTIONS — adjust to match your actual schema/column names:
//   - loan_products has a `min_guarantors` int column (nullable -> default 1)
//   - loan_applications(id, tenant_id, member_id, loan_product_id,
//       amount_requested, term_months, purpose, status, submitted_at, created_at)
//   - loan_application_guarantors(id, tenant_id, loan_application_id,
//       guarantor_member_id (nullable, if matched to an existing member),
//       full_name, phone, national_id, relationship, guaranteed_amount,
//       status ('pending' | 'approved' | 'declined'), created_at)
//   - notifications(id, tenant_id, user_id, type, title, body,
//       related_entity_type, related_entity_id, read, created_at)
//   - A guarantor is matched to an existing member by national_id within the
//     same tenant. If no match, no in-app notification can be sent — you'll
//     likely want an SMS invite via Africa's Talking as a fallback (noted
//     below) so unregistered guarantors know they've been added.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface GuarantorInput {
  fullName: string;
  phone: string;
  nationalId: string;
  relationship: string;
  guaranteedAmount: number;
}

interface LoanApplicationBody {
  memberId: string;
  loanProductId: string;
  amountRequested: number;
  termMonths: number;
  purpose: string;
  guarantors: GuarantorInput[];
}

export async function POST(req: NextRequest) {
  // --- Auth -----------------------------------------------------------
  const auth = await verifyAuthToken(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tenantId, userId, role } = auth;

  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant context" }, { status: 400 });
  }

  // --- Parse & basic validation ----------------------------------------
  let body: LoanApplicationBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memberId, loanProductId, amountRequested, termMonths, purpose, guarantors } = body;

  if (!memberId || !UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "Invalid member." }, { status: 400 });
  }
  if (!loanProductId || !UUID_RE.test(loanProductId)) {
    return NextResponse.json({ error: "Invalid loan product." }, { status: 400 });
  }
  if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    return NextResponse.json({ error: "Enter a valid repayment term." }, { status: 400 });
  }
  if (!purpose || !purpose.trim()) {
    return NextResponse.json({ error: "Purpose is required." }, { status: 400 });
  }
  if (!Array.isArray(guarantors)) {
    return NextResponse.json({ error: "Guarantors must be a list." }, { status: 400 });
  }

  // Members can only apply for themselves; staff can submit on a member's behalf.
  if (role === "member" && userId !== memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const g of guarantors) {
    if (!g.fullName?.trim() || !g.phone?.trim() || !g.nationalId?.trim()) {
      return NextResponse.json({ error: "Each guarantor needs a name, phone, and national ID." }, { status: 400 });
    }
    if (!Number.isFinite(g.guaranteedAmount) || g.guaranteedAmount <= 0) {
      return NextResponse.json({ error: "Each guarantor needs a valid guaranteed amount." }, { status: 400 });
    }
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);

    // --- Look up the loan product & its guarantor requirement ----------
    const productResult = await client.query(
      `SELECT
         id,
         name,
         min_guarantors AS "minGuarantors",
         min_amount AS "minAmount",
         max_amount AS "maxAmount",
         is_active AS "isActive"
       FROM loan_products
       WHERE id = $1 AND tenant_id = $2`,
      [loanProductId, tenantId]
    );

    if (productResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Loan product not found." }, { status: 404 });
    }

    const product = productResult.rows[0];

    if (!product.isActive) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This loan product is not currently available." }, { status: 400 });
    }

    if (product.minAmount != null && amountRequested < Number(product.minAmount)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Minimum amount for ${product.name} is KES ${Number(product.minAmount).toLocaleString()}.` },
        { status: 400 }
      );
    }
    if (product.maxAmount != null && amountRequested > Number(product.maxAmount)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Maximum amount for ${product.name} is KES ${Number(product.maxAmount).toLocaleString()}.` },
        { status: 400 }
      );
    }

    const requiredGuarantors = product.minGuarantors ?? 1;
    if (guarantors.length < requiredGuarantors) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: `${product.name} requires at least ${requiredGuarantors} guarantor${
            requiredGuarantors === 1 ? "" : "s"
          }. You submitted ${guarantors.length}.`,
        },
        { status: 400 }
      );
    }

    // --- Confirm the member exists in this tenant -----------------------
    const memberResult = await client.query(
      `SELECT id, full_name AS "fullName" FROM members WHERE id = $1 AND tenant_id = $2`,
      [memberId, tenantId]
    );
    if (memberResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    const applicantName: string = memberResult.rows[0].fullName;

    // --- Insert the loan application -------------------------------------
    const applicationResult = await client.query(
      `INSERT INTO loan_applications
         (tenant_id, member_id, loan_product_id, amount_requested, term_months,
          purpose, status, submitted_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_guarantor_approval', now(), now())
       RETURNING id AS "applicationId", status`,
      [tenantId, memberId, loanProductId, amountRequested, termMonths, purpose.trim()]
    );

    const applicationId = applicationResult.rows[0].applicationId;

    // --- Insert guarantors & notify any that match an existing member ----
    let matchedGuarantorAccounts = 0;

    for (const g of guarantors) {
      // Try to match this guarantor to an existing member account by
      // national ID within the same tenant, so we know who to notify.
      const matchResult = await client.query(
        `SELECT id, user_id AS "userId" FROM members WHERE national_id = $1 AND tenant_id = $2`,
        [g.nationalId.trim(), tenantId]
      );
      const matchedMember = matchResult.rows[0] ?? null;

      const guarantorInsert = await client.query(
        `INSERT INTO loan_application_guarantors
           (tenant_id, loan_application_id, guarantor_member_id, full_name, phone,
            national_id, relationship, guaranteed_amount, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now())
         RETURNING id AS "guarantorId"`,
        [
          tenantId,
          applicationId,
          matchedMember?.id ?? null,
          g.fullName.trim(),
          g.phone.trim(),
          g.nationalId.trim(),
          g.relationship ?? null,
          g.guaranteedAmount,
        ]
      );
      const guarantorId = guarantorInsert.rows[0].guarantorId;

      if (matchedMember?.userId) {
        await client.query(
          `INSERT INTO notifications
             (tenant_id, user_id, type, title, body, related_entity_type, related_entity_id, read, created_at)
           VALUES ($1, $2, 'guarantor_approval_request', $3, $4, 'loan_application_guarantor', $5, false, now())`,
          [
            tenantId,
            matchedMember.userId,
            "Guarantee request",
            `${applicantName} has listed you as a guarantor for KES ${g.guaranteedAmount.toLocaleString()} on a loan application. Please review and approve or decline.`,
            guarantorId,
          ]
        );
        matchedGuarantorAccounts += 1;
      }
      // TODO: for guarantors with no matched account (matchedMember is null),
      // send an SMS via Africa's Talking inviting them to register/log in
      // and respond to the guarantee request, since they have no in-app
      // notification target yet.
    }

    // --- Audit log ----------------------------------------------------------
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, 'loan_application_submitted', 'loan_application', $3, $4, now())`,
      [
        tenantId,
        userId,
        applicationId,
        JSON.stringify({
          loanProductId,
          amountRequested,
          termMonths,
          guarantorCount: guarantors.length,
          notifiedGuarantors: matchedGuarantorAccounts,
        }),
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        applicationId,
        status: "pending_guarantor_approval",
        notifiedGuarantors: matchedGuarantorAccounts,
        totalGuarantors: guarantors.length,
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Loan application submission failed:", err);
    return NextResponse.json({ error: "Something went wrong submitting your application." }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}