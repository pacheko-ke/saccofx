import { NextRequest, NextResponse } from "next/server";
import {sql} from "@/app/lib/db"

interface BulkMemberInput {
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  phone: string;
  email: string;
  physicalAddress: string;
  county: string;
  kinFullName: string;
  kinRelationship: string;
  kinPhone: string;
  memberType: string;
  monthlyContribution: string;
  numberOfShares: string;
  incomeSource: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { members: BulkMemberInput[] };

    if (!body.members || !Array.isArray(body.members) || body.members.length === 0) {
      return NextResponse.json({ error: "No members provided" }, { status: 400 });
    }

    let imported = 0;
    let failed = 0;
    const failures: { row: number; reason: string }[] = [];

    for (const [i, m] of body.members.entries()) {
      try {
        // Adjust column names/table to match your actual members schema.
        await sql`
          INSERT INTO members (
            full_name,
            id_number,
            date_of_birth,
            gender,
            marital_status,
            phone,
            email,
            physical_address,
            county,
            kin_full_name,
            kin_relationship,
            kin_phone,
            member_type,
            monthly_contribution,
            number_of_shares,
            income_source,
            status,
            created_at
          ) VALUES (
            ${m.fullName},
            ${m.idNumber},
            ${m.dateOfBirth},
            ${m.gender},
            ${m.maritalStatus},
            ${m.phone},
            ${m.email},
            ${m.physicalAddress},
            ${m.county},
            ${m.kinFullName},
            ${m.kinRelationship},
            ${m.kinPhone},
            ${m.memberType},
            ${Number(m.monthlyContribution)},
            ${Number(m.numberOfShares)},
            ${m.incomeSource},
            'pending',
            now()
          )
        `;
        imported++;
      } catch (err) {
        failed++;
        failures.push({ row: i + 1, reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return NextResponse.json({ imported, failed, failures }, { status: 201 });
  } catch (err) {
    console.error("Bulk member import error:", err);
    return NextResponse.json({ error: "Failed to import members" }, { status: 500 });
  }
}