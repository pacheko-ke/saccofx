import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Pool } from "@neondatabase/serverless";
import { verifyAuthToken } from "@/app/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^(?:\+254|0)\d{9}$/;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest) {
  // --- Auth ------------------------------------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
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

  // Adjust to actual role names
  if (!["admin", "staff", "loan_officer", "teller", "member_portal_user"].includes(role)) {
    return NextResponse.json({ error: "Not authorized to register members" }, { status: 403 });
  }

  // --- Parse & validate --------------------------------------------------
  const body = await req.json();
  const {
    fullName,
    idNumber,
    dateOfBirth,
    gender,
    maritalStatus,
    phone,
    email,
    physicalAddress,
    county,
    kinFullName,
    kinRelationship,
    kinPhone,
    memberType,
    monthlyContribution,
    numberOfShares,
    incomeSource,
  } = body ?? {};

  // Never trust client-side validation — re-check everything server-side
  const errors: Record<string, string> = {};
  if (!fullName?.trim()) errors.fullName = "Full name is required";
  if (!idNumber?.trim() || !/^\d{6,10}$/.test(idNumber.trim())) errors.idNumber = "Invalid ID number";
  if (!dateOfBirth) errors.dateOfBirth = "Date of birth is required";
  if (!gender) errors.gender = "Gender is required";
  if (!phone?.trim() || !PHONE_RE.test(phone.trim())) errors.phone = "Invalid phone number";
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Invalid email address";
  if (!physicalAddress?.trim()) errors.physicalAddress = "Address is required";
  if (!county?.trim()) errors.county = "County is required";
  if (!kinFullName?.trim()) errors.kinFullName = "Next of kin name is required";
  if (!kinRelationship?.trim()) errors.kinRelationship = "Next of kin relationship is required";
  if (!kinPhone?.trim() || !PHONE_RE.test(kinPhone.trim())) errors.kinPhone = "Invalid next of kin phone";
  if (!monthlyContribution || Number(monthlyContribution) <= 0)
    errors.monthlyContribution = "Invalid monthly contribution";
  if (!numberOfShares || Number(numberOfShares) <= 0) errors.numberOfShares = "Invalid number of shares";
  if (!incomeSource?.trim()) errors.incomeSource = "Income source is required";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", fields: errors }, { status: 400 });
  }

  // --- Insert (RLS-scoped) ------------------------------------------------
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // SET LOCAL can't take $1 placeholders — tenantId/userId are UUID-regex
    // validated above, so string interpolation here is safe.
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);

    const dup = await client.query(
      `SELECT m.member_id, u.tenant_id FROM users u
      INNER JOIN members m ON m.member_id= u.member_id
      WHERE u.tenant_id = $1 AND m.id_number = $2 AND deleted_at IS NULL`,
      [tenantId, idNumber.trim()]
    );
    if (dup.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Validation failed", fields: { idNumber: "A member with this ID number already exists" } },
        { status: 409 }
      );
    }

    const result = await client.query(
      `INSERT INTO members (
         tenant_id, first_name, id_number, date_of_birth, gender, marital_status,
         phone_primary, email, physical_address, county,
        
       monthly_contribution,
         status, created_by,member_number,last_name
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
        
         $11, $12,$13,$14,$15
       )
       RETURNING member_id`,
      [
        tenantId,
        fullName.trim(),
        idNumber.trim(),
        dateOfBirth,
        gender,
        maritalStatus || null,
        phone.trim(),
        email?.trim() || null,
        physicalAddress.trim(),
        county.trim(),
        Number(monthlyContribution),
        'pending',
        userId,
        'FPK-00150',
        fullName.trim()
      ]
    );


    const memberId = result.rows[0].member_id

    const kin_result = await client.query(
      `INSERT INTO next_of_kin (
         tenant_id, full_name, id_number,
         phone, relationship,member_id
        
       ) VALUES (
         $1, $2, $3, $4, $5, $6
      
       )
       RETURNING id, full_name, status`,
      [
        tenantId,
        kinFullName.trim(),
        idNumber.trim(),
        kinPhone.trim(),
        kinRelationship.trim(),

        memberId,
      ]
    );

    await client.query("COMMIT");
    return NextResponse.json({ member: result.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Member registration failed:", err);
    return NextResponse.json({ error: "Failed to register member" }, { status: 500 });
  } finally {
    client.release();
  }
}