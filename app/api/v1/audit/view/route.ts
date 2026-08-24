// app/api/v1/security/audit-log/route.ts
import { NextRequest, NextResponse } from "next/server";
import {pool} from "@/app/lib/db"
import { verifyAuthToken } from "@/app/lib/auth";


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowlists — mirror the frontend's action_OPTIONS / OUTCOME_OPTIONS.
// Never interpolate these query params directly into SQL without checking
// against a list like this first.
const actionS = ["login", "logout", "create", "update", "delete", "view", "config"] as const;
const OUTCOMES = ["success", "failed", "denied"] as const;
type ActionKind = (typeof actionS)[number];
type Outcome = (typeof OUTCOMES)[number];

const MAX_PAGE_SIZE = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Roles considered "elevated" for the security overview card.
// Adjust to match whatever role strings your `users.role` column actually uses.
const ELEVATED_ROLES = ["admin", "super_admin"] as const;

interface ParsedFilters {
  page: number;
  pageSize: number;
  q: string | null;
  actionKind: ActionKind | null;
  outcome: Outcome | null;
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
}

function parseFilters(searchParams: URLSearchParams): ParsedFilters {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? "20");

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize =
    Number.isInteger(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, MAX_PAGE_SIZE)
      : 20;

  const qRaw = searchParams.get("q");
  const q = qRaw && qRaw.trim().length > 0 ? qRaw.trim().slice(0, 200) : null;

  const actionKindRaw = searchParams.get("actionKind");
  const actionKind = actionS.includes(actionKindRaw as ActionKind)
    ? (actionKindRaw as ActionKind)
    : null;

  const outcomeRaw = searchParams.get("outcome");
  const outcome = OUTCOMES.includes(outcomeRaw as Outcome) ? (outcomeRaw as Outcome) : null;

  const fromRaw = searchParams.get("from");
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : null;

  const toRaw = searchParams.get("to");
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : null;

  return { page, pageSize, q, actionKind, outcome, from, to };
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

  // Only staff (not member-portal users) should see the audit trail.
  if (payload.role === "member") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const tenantId = String(payload.userId ?? "");
  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const { page, pageSize, q, actionKind, outcome, from, to } = parseFilters(req.nextUrl.searchParams);
  const offset = (page - 1) * pageSize;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // SET LOCAL can't take $1 placeholders — safe here only because
    // tenantId was validated against UUID_RE above.
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // ── Build WHERE clause dynamically but safely (parameterized) ────
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
      conditions.push(`al.action = $${values.length}`);
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
      // inclusive of the whole "to" day
      values.push(to);
      conditions.push(`al.created_at < ($${values.length}::date + interval '1 day')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // ── Total count for pagination ─────────────────────────────────
    const countResult = await client.query(
      `SELECT COUNT(*) AS total
       FROM audit_logs al
       JOIN users u ON u.user_id = al.user_id
       ${whereClause}`,
      values
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    // ── Page of entries ───────────────────────────────────────────
    const entriesValues = [...values, pageSize, offset];
    const entriesResult = await client.query(
      `SELECT
        al.audit_id,
        al.created_at,
        u.username AS actor_name,
       
        al.action AS action,
        
        al.entity_type,
        al.ip_address
      
       FROM audit_logs al
       JOIN users u ON u.user_id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${entriesValues.length - 1} OFFSET $${entriesValues.length}`,
      entriesValues
    );

    // ── Overview stats (independent of the filters above) ─────────
    const overviewResult = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM audit_logs
          WHERE action = 'USER_LOGIN' AND outcome = 'failed'
            AND created_at >= now() - interval '24 hours') AS failed_logins_24h,
        (SELECT COUNT(*) FROM audit_logs
          WHERE action = 'USER_LOGIN' AND outcome = 'failed'
            AND created_at >= now() - interval '48 hours'
            AND created_at < now() - interval '24 hours') AS failed_logins_prev_24h,
        (SELECT COUNT(*) FROM user_sessions
          WHERE expires_at > now() AND revoked_at IS NULL) AS active_sessions,
        (SELECT COUNT(*) FROM audit_logs al2
          JOIN users u2 ON u2.user_id = al2.user_id
          WHERE u2.role = ANY($1::text[])
            AND al2.created_at >= now() - interval '7 days') AS admin_actions_7d,
        (SELECT COUNT(*) FROM users WHERE role = ANY($1::text[]) AND status = 'active') AS elevated_role_users,
        (SELECT MAX(created_at) FROM audit_logs WHERE action = 'view' AND entity = 'Audit Log Export') AS last_export_at
      `,
      [ELEVATED_ROLES]
    );

    await client.query("COMMIT");

    const ov = overviewResult.rows[0];
    const failedLogins24h = Number(ov.failed_logins_24h ?? 0);
    const failedLoginsPrev24h = Number(ov.failed_logins_prev_24h ?? 0);
    const failedLoginsChangePct =
      failedLoginsPrev24h === 0
        ? failedLogins24h === 0
          ? 0
          : 100
        : ((failedLogins24h - failedLoginsPrev24h) / failedLoginsPrev24h) * 100;

    return NextResponse.json({
      overview: {
        failedLogins24h,
        failedLoginsChangePct,
        activeSessions: Number(ov.active_sessions ?? 0),
        adminActions7d: Number(ov.admin_actions_7d ?? 0),
        elevatedRoleUsers: Number(ov.elevated_role_users ?? 0),
        lastExportAt: ov.last_export_at ?? null,
      },
      entries: entriesResult.rows.map((r) => ({
        id: r.audit_id,
        timestamp: r.created_at,
        actorName: r.actor_name,
        actorRole: r.actor_role,
        action: r.action,
        actionKind: r.action,
        entity: r.entity,
        ipAddress: r.ip_address,
        outcome: r.outcome,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Audit log fetch failed:", err);
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  } finally {
    client.release();
  }
}