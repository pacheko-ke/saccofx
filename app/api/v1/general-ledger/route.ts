import { NextRequest, NextResponse } from "next/server";
import {sql} from "@/app/lib/db"

const PAGE_SIZE = 50;

/**
 * GET /api/general-ledger
 *
 * Query params (all optional):
 *   accountId   - filter to a single account (gl_accounts.account_id)
 *   dateFrom    - ISO date, inclusive
 *   dateTo      - ISO date, inclusive
 *   search      - matches entry reference or description
 *   page        - 1-indexed page number (default 1)
 *
 * Returns journal entry lines joined with their parent entry and account,
 * ordered oldest -> newest. When accountId is set, a running balance is
 * computed across the *entire* filtered set (not just the current page) so
 * the balance column is accurate, then the page slice is returned.
 *
 * NOTE: adjust table/column names below to match your actual
 * journal_entries / journal_entry_lines / gl_accounts schema.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (accountId) {
      params.push(accountId);
      conditions.push(`l.gl_account_id = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`e.entry_date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`e.entry_date <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(e.reference) LIKE $${params.length} OR LOWER(e.description) LIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Fetch the full filtered set (needed to compute a correct running balance),
    // ordered chronologically. For very large ledgers, consider constraining
    // with a mandatory date range instead of allowing an unbounded fetch.
    const rows = await sql.query(
      `
      SELECT
        l.journal_line_id AS line_id,
        e.reference_id,
        e.entry_date,
        e.reference_type,
        e.description AS entry_description,
        l.debit,
        l.credit,
        a.gl_account_id,
        a.account_code,
        a.account_name,
        a.account_type
      FROM gl_journal_lines l
      JOIN gl_journal_entries e ON e.journal_id = l.journal_id
      JOIN gl_accounts a ON a.gl_account_id = l.gl_account_id
      ${whereClause}
      ORDER BY e.entry_date ASC, e.reference_id ASC, l.journal_line_id ASC
      `,
      params
    );

    // Running balance only makes sense when scoped to a single account.
    let runningBalance = 0;
    const withBalance = rows.map((r: any) => {
      const debit = Number(r.debit) || 0;
      const credit = Number(r.credit) || 0;
      if (accountId) {
        runningBalance += debit - credit;
      }
      return { ...r, running_balance: accountId ? runningBalance : null };
    });

    const totalDebits = withBalance.reduce((sum: number, r: any) => sum + (Number(r.debit) || 0), 0);
    const totalCredits = withBalance.reduce((sum: number, r: any) => sum + (Number(r.credit) || 0), 0);

    const totalCount = withBalance.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const paged = withBalance.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({
      entries: paged,
      pagination: { page, pageSize: PAGE_SIZE, totalCount, totalPages },
      summary: { totalDebits, totalCredits, net: totalDebits - totalCredits },
    });
  } catch (err) {
    console.error("General ledger fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch general ledger" }, { status: 500 });
  }
}