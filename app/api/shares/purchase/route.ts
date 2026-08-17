import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthPayload() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) return null;
  try {
    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}

interface PurchaseRequestBody {
  memberId?: string;
  shares?: number;
  certificateNo?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  // ---- Auth --------------------------------------------------------------
  const payload = await getAuthPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member_id = payload.memberId;
  console.log(`member is is is ${member_id}`)
  if (!member_id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  // Only tellers/back-office roles should be able to record purchases —
  // adjust the allowed roles to match your role model.
  const allowedRoles = ["teller", "admin", "manager"];
  if (typeof payload.role !== "string" || !allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---- Parse & validate body ----------------------------------------------
  let body: PurchaseRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memberId, shares, certificateNo, notes } = body;
  console.log(memberId)

  if (typeof memberId !== "string" || !UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "A valid memberId is required" }, { status: 400 });
  }

  if (!Number.isInteger(shares) || (shares as number) <= 0) {
    return NextResponse.json({ error: "Shares must be a positive whole number" }, { status: 400 });
  }
  const sharesToAdd = shares as number;

  if (certificateNo !== undefined && (typeof certificateNo !== "string" || certificateNo.length > 32)) {
    return NextResponse.json({ error: "Invalid certificate number" }, { status: 400 });
  }

  if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) {
    return NextResponse.json({ error: "Notes too long" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // tenantId is validated via Number.isInteger() above — SET LOCAL can't take placeholders
    await client.query(`SET LOCAL app.current_tenant = ${memberId}`);

    // ---- Lock the member's share account row ------------------------------
    const { rows: accountRows } = await client.query(
      `
      SELECT sa.id, sa.shares_held, sa.certificate_no, sa.status, m.full_name, m.member_no
      FROM "ShareAccount" sa
      JOIN "Member" m ON m.id = sa.member_id
      WHERE sa.member_id = $1
      FOR UPDATE
      `,
      [memberId]
    );

    if (accountRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Member has no share account on this tenant" }, { status: 404 });
    }

    const account = accountRows[0];

    if (account.status === "transferred") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Cannot record a purchase against a transferred share account" },
        { status: 409 }
      );
    }

    // ---- Get par value from tenant config (fallback to 100) ----------------
    const { rows: configRows } = await client.query(
      `SELECT par_value_kes FROM "SaccoConfig" WHERE tenant_id = $1 LIMIT 1`,
      [memberId]
    );
    const parValueKes = configRows[0]?.par_value_kes ?? 100;
    const amountKes = sharesToAdd * parValueKes;

    // ---- Resolve certificate number -----------------------------------------
    let resolvedCertificateNo = certificateNo?.trim();
    if (!resolvedCertificateNo) {
      resolvedCertificateNo = account.certificate_no;
      if (!resolvedCertificateNo) {
        const { rows: seqRows } = await client.query(
          `SELECT nextval('share_certificate_seq') AS seq`
        );
        const seq = seqRows[0].seq;
        resolvedCertificateNo = `CERT-${String(seq).padStart(5, "0")}`;
      }
    }

    // ---- Insert the transaction ledger entry --------------------------------
    const { rows: txnRows } = await client.query(
      `
      INSERT INTO "ShareTransaction"
        (share_account_id, tenant_id, type, shares, amount_kes, notes, recorded_by, created_at)
      VALUES
        ($1, $2, 'purchase', $3, $4, $5, $6, now())
      RETURNING id, created_at
      `,
      [account.id, memberId, sharesToAdd, amountKes, notes ?? null, payload.userId]
    );

    // ---- Update the share account balance ------------------------------------
    const newSharesHeld = account.shares_held + sharesToAdd;
    const { rows: updatedRows } = await client.query(
      `
      UPDATE "ShareAccount"
      SET shares_held = $1,
          certificate_no = $2,
          status = 'active',
          updated_at = now()
      WHERE id = $3
      RETURNING shares_held, certificate_no, status, updated_at
      `,
      [newSharesHeld, resolvedCertificateNo, account.id]
    );

    await client.query("COMMIT");

    const updated = updatedRows[0];
    return NextResponse.json({
      transactionId: txnRows[0].id,
      holding: {
        memberNo: account.member_no,
        name: account.full_name,
        certificateNo: updated.certificate_no,
        sharesHeld: updated.shares_held,
        status: updated.status,
        lastActivityAt: updated.updated_at,
      },
      amountKes,
      parValueKes,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/shares/purchase failed:", err);
    return NextResponse.json({ error: "Failed to record share purchase" }, { status: 500 });
  } finally {
    client.release();
  }
}