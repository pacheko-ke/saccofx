import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Pool } from "@neondatabase/serverless";
import { verifyAuthToken } from "@/lib/auth/jwt";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^(?:\+254|0)\d{9}$/;
const MAX_ROWS = 500;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface BulkMemberInput {
  fullName?: string;
  idNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  phone?: string;
  email?: string;
  physicalAddress?: string;
  county?: string;
  kinFullName?: string;
  kinRelationship?: string;
  kinPhone?: string;
  memberType?: string;
  monthlyContribution?: string;
  numberOfShares?: string;
  incomeSource?: string;
}

// Mirrors the client-side checks in parseWorkbookToRows so a row that made
// it past the browser preview can't still slip in something invalid.
function validateRow(m: BulkMemberInput): string | null {
  if (!m.fullName?.trim()) return "Full name is required";
  if (!m.idNumber?.trim() || !/^\d{6,10}$/.test(m.idNumber.trim())) return "Invalid ID number";
  if (!m.phone?.trim() || !PHONE_RE.test(m.phone.trim())) return "Invalid phone number";
  if (!m.county?.trim()) return "County is required";
  if (!m.monthlyContribution || Number(m.monthlyContribution) <= 0) return "Invalid monthly contribution";
  if (!m.numberOfShares || Number(m.numberOfShares) <= 0) return "Invalid number of shares";
  if (m.kinPhone && !PHONE_RE.test(m.kinPhone.trim())) return "Invalid next of kin phone";
  return null;
}

export async function POST(req: NextRequest) {
  // --- Auth ------------------------------------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get("sfx_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { tenantId, userId, role } = payload;

  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  // Bulk import is more destructive than single-add — restrict further
  if (!["admin", "staff"].includes(role)) {
    return NextResponse.json({ error: "Not authorized to bulk import members" }, { status: 403 });
  }

  // --- Parse ---------------------------------------------------------
  const body = await req.json();
  const members: BulkMemberInput[] = Array.isArray(body?.members) ? body.members : [];

  if (members.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 });
  }
  if (members.length > MAX_ROWS) {
    return NextResponse.json({ error: `Cannot import more than ${MAX_ROWS} members at once` }, { status: 400 });
  }

  // --- Insert row-by-row, one failure shouldn't sink the batch -----------
  const client = await pool.connect();
  const results: { row: number; status: "imported" | "failed"; error?: string; id?: string }[] = [];

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const rowLabel = i + 1;

      const validationError = validateRow(m);
      if (validationError) {
        results.push({ row: rowLabel, status: "failed", error: validationError });
        continue;
      }

      await client.query("SAVEPOINT row_import");
      try {
        const dup = await client.query(
          `SELECT id FROM members WHERE tenant_id = $1 AND id_number = $2 AND deleted_at IS NULL`,
          [tenantId, m.idNumber!.trim()]
        );
        if (dup.rows.length > 0) {
          throw new Error("A member with this ID number already exists");
        }

        const insertResult = await client.query(
          `INSERT INTO members (
             tenant_id, full_name, id_number, date_of_birth, gender, marital_status,
             phone, email, physical_address, county,
             kin_full_name, kin_relationship, kin_phone,
             member_type, monthly_contribution, number_of_shares, income_source,
             status, created_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10,
             $11, $12, $13,
             $14, $15, $16, $17,
             'pending', $18
           )
           RETURNING id`,
          [
            tenantId,
            m.fullName!.trim(),
            m.idNumber!.trim(),
            m.dateOfBirth || null,
            m.gender || null,
            m.maritalStatus || null,
            m.phone!.trim(),
            m.email?.trim() || null,
            m.physicalAddress?.trim() || null,
            m.county!.trim(),
            m.kinFullName?.trim() || null,
            m.kinRelationship?.trim() || null,
            m.kinPhone?.trim() || null,
            m.memberType || "individual",
            Number(m.monthlyContribution),
            Number(m.numberOfShares),
            m.incomeSource?.trim() || null,
            userId,
          ]
        );

        await client.query("RELEASE SAVEPOINT row_import");
        results.push({ row: rowLabel, status: "imported", id: insertResult.rows[0].id });
      } catch (rowErr) {
        await client.query("ROLLBACK TO SAVEPOINT row_import");
        results.push({
          row: rowLabel,
          status: "failed",
          error: rowErr instanceof Error ? rowErr.message : "Failed to import row",
        });
      }
    }

    await client.query("COMMIT");

    const imported = results.filter((r) => r.status === "imported").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({ imported, failed, results }, { status: 200 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Bulk member import failed:", err);
    return NextResponse.json({ error: "Failed to import members" }, { status: 500 });
  } finally {
    client.release();
  }
}