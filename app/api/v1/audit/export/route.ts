// app/api/v1/security/audit-log/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import {pool} from "@/app/lib/db"
import { verifyAuthToken } from "@/app/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION_KINDS = ["login", "logout", "create", "update", "delete", "view", "config"] as const;
const OUTCOMES = ["success", "failed", "denied"] as const;
type ActionKind = (typeof ACTION_KINDS)[number];
type Outcome = (typeof OUTCOMES)[number];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Hard ceiling on export size so a broad/unfiltered export can't lock up
// the connection or blow past the serverless response size limit.
const MAX_EXPORT_ROWS = 20_000;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  if (payload.role === "member") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const tenantId = String(payload.tenantId ?? "");
  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  const searchParams = req.nextUrl.searchParams;

  const qRaw = searchParams.get("q");
  const q = qRaw && qRaw.trim().length > 0 ? qRaw.trim().slice(0, 200) : null;

  const actionKindRaw = searchParams.get("actionKind");
  const actionKind = ACTION_KINDS.includes(actionKindRaw as ActionKind)
    ? (actionKindRaw as ActionKind)
    : null;

  const outcomeRaw = searchParams.get("outcome");
  const outcome = OUTCOMES.includes(outcomeRaw as Outcome) ? (outcomeRaw as Outcome) : null;

  const fromRaw = searchParams.get("from");
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : null;

  const toRaw = searchParams.get("to");
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (q) {
      values.push(`%${q.toLowerCase()}%`);
      const idx = values.length;
      conditions.push(
        `(lower(u.username) LIKE $${idx} OR lower(al.action_description) LIKE $${idx} OR lower(al.entity) LIKE $${idx})`
      );
    }
    if (actionKind) {
      values.push(actionKind);
      conditions.push(`al.action_kind = $${values.length}`);
    }
    if (outcome) {
      values.push(outcome);
      conditions.push(`al.outcome = $${values.length}`);
    }
    if (from) {
      values.push(from);
      conditions.push(`al.created_at >= $${values.length}::date`);
    }
    if (to) {
      values.push(to);
      conditions.push(`al.created_at < ($${values.length}::date + interval '1 day')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    values.push(MAX_EXPORT_ROWS);
    const result = await client.query(
      `SELECT
        al.created_at,
        u.username AS actor_name,
        COALESCE(u.role, 'unknown') AS actor_role,
        al.action_description AS action,
        al.action_kind,
        al.entity,
        al.ip_address,
        al.outcome
       FROM audit_log al
       JOIN users u ON u.user_id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${values.length}`,
      values
    );

    // Record the export itself as an auditable event — also what
    // the "Last exported" footer on the frontend reads back.
    await client.query(
      `INSERT INTO audit_log (user_id, action_description, action_kind, entity, ip_address, outcome, created_at)
       VALUES ($1, $2, 'view', 'Audit Log Export', $3, 'success', now())`,
      [
        payload.userId,
        `Exported audit log (${result.rows.length} rows)`,
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      ]
    );

    await client.query("COMMIT");

    const header = ["Timestamp", "User", "Role", "Action", "Action Type", "Entity", "IP Address", "Outcome"];
    const lines = [header.join(",")];

    for (const r of result.rows) {
      lines.push(
        [
          csvEscape(new Date(r.created_at).toISOString()),
          csvEscape(r.actor_name),
          csvEscape(r.actor_role),
          csvEscape(r.action),
          csvEscape(r.action_kind),
          csvEscape(r.entity),
          csvEscape(r.ip_address),
          csvEscape(r.outcome),
        ].join(",")
      );
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="saccofx-audit-log-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Audit log export failed:", err);
    return NextResponse.json({ error: "Failed to export audit log" }, { status: 500 });
  } finally {
    client.release();
  }
}