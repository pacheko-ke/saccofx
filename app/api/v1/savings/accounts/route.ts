import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/app/lib/auth";
import { pool } from "@/app/lib/db";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Roles to be fetched from db

const STAFF_ROLES = ["admin", "staff", "teller", "manager","member_portal_user"];

function generateAccountNumber(memberNumber: string) {
  // e.g. SV-000123-4821  (product-agnostic, human-scannable, collision-safe
  // enough combined with the DB unique constraint + retry below)
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SV-${memberNumber}-${suffix}`;
}

export async function POST(req: NextRequest) {
  // 1. Auth — verified inline per route, per project convention
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = payload.tenantId as string;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant context" }, { status: 400 });
  }

  const role = (payload.role as string) ?? "";
  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = payload.userId as string;

  // 2. Parse + validate body
  let body: { memberId?: string; productId?: string; initialDeposit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { memberId, productId, initialDeposit } = body;

  if (!memberId || !UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "A valid memberId is required" }, { status: 400 });
  }
  if (!productId || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: "A valid productId is required" }, { status: 400 });
  }
  const deposit = Number(initialDeposit ?? 0);
  if (Number.isNaN(deposit) || deposit < 0) {
    return NextResponse.json({ error: "initialDeposit must be a non-negative number" }, { status: 400 });
  }

  // 3. Checked-out client held for the whole transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // tenantId is regex-validated above; SET LOCAL cannot take a bound parameter
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // Confirm member exists, is active, and belongs to this tenant
    const memberResult = await client.query(
      `SELECT member_id, member_number AS "memberNumber", status
       FROM members
       WHERE member_id = $1 AND status='active'`,
      [memberId]
    );
    const member = memberResult.rows[0];
    if (!member) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (member.status !== "active") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Member is not active" }, { status: 400 });
    }

    // Confirm product exists and is active
    const productResult = await client.query(
      `SELECT savings_product_id, product_name, minimum_balance AS "minOpeningBalance"
       FROM savings_products
       WHERE savings_product_id = $1 AND is_active = 't'`,
      [productId]
    );
    const product = productResult.rows[0];
    if (!product) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Savings product not found or inactive" }, { status: 404 });
    }
    const minOpening = Number(product.minOpeningBalance ?? 0);
    if (deposit < minOpening) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Opening deposit must be at least ${minOpening} for ${product.name}` },
        { status: 400 }
      );
    }

    // Insert the account, retrying once on a generated-number collision
    let accountId: string;
    let accountNumber: string;
    try {
      accountNumber = generateAccountNumber(member.memberNumber);
      const insertResult = await client.query(
        `INSERT INTO savings_accounts
           (tenant_id, member_id, savings_product_id, account_number, balance, status, opened_by, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, now())
         RETURNING savings_product_id,account_number`,
        [tenantId, memberId, productId, accountNumber, deposit, userId]
      );
      accountId = insertResult.rows[0].savings_product_id;
    } catch (err: unknown) {
      // Unique violation on account_number — regenerate and retry once
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
        accountNumber = generateAccountNumber(member.memberNumber);
        const retryResult = await client.query(
          `INSERT INTO savings_accounts
             (tenant_id, member_id, product_id, account_number, balance, status, opened_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, now())
           RETURNING savings_account_id, account_number`,
          [tenantId, memberId, productId, accountNumber, deposit, userId]
        );
        accountId = retryResult.rows[0].savings_account_id;
      } else {
        throw err;
      }
    }

    // Record the opening deposit as the first ledger entry, if any
    if (deposit > 0) {
      await client.query(
        `INSERT INTO transactions
           (tenant_id, savings_account_id, tx_type, amount, balance_after, narrative, processed_by,channel)
         VALUES ($1, $2, 'deposit', $3, $4, 'Opening deposit', $5,$6)`,
        [tenantId, accountId, deposit, userId,'teller']
      );
    }

    // Audit trail
    await client.query(
      `INSERT INTO audit_log
         (tenant_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, 'create', 'savings_account', $3, $4, now())`,
      [
        tenantId,
        userId,
        accountId,
        JSON.stringify({ memberId, productId, openingDeposit: deposit }),
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        account: {
          id: accountId,
          accountNumber,
          memberId,
          productId,
          balance: deposit,
          status: "active",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to open savings account:", err);
    return NextResponse.json({ error: "Failed to open account" }, { status: 500 });
  } finally {
    client.release();
  }
}