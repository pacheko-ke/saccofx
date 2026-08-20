import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Font, StyleSheet } from "@react-pdf/renderer";

// --- Font loading, with a fallback so a missing .ttf doesn't crash PDF
// generation for every dev who clones the repo without the font files. ---

const fontDir = path.join(process.cwd(), "public", "fonts");

function fontExists(filename: string): boolean {
  try {
    return fs.existsSync(path.join(fontDir, filename));
  } catch {
    return false;
  }
}

const sansAvailable =
  fontExists("IBMPlexSans-Regular.ttf") &&
  fontExists("IBMPlexSans-Medium.ttf") &&
  fontExists("IBMPlexSans-Bold.ttf");

const monoAvailable = fontExists("IBMPlexMono-Regular.ttf") && fontExists("IBMPlexMono-Medium.ttf");

const serifAvailable = fontExists("SourceSerif4-Regular.ttf") && fontExists("SourceSerif4-Bold.ttf");

if (sansAvailable) {
  Font.register({
    family: "PlexSans",
    fonts: [
      { src: path.join(fontDir, "IBMPlexSans-Regular.ttf") },
      { src: path.join(fontDir, "IBMPlexSans-Medium.ttf"), fontWeight: 500 },
      { src: path.join(fontDir, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
} else {
  console.warn(
    "[MemberStatementDocument] IBM Plex Sans .ttf files not found in public/fonts — falling back to Helvetica for statement PDFs."
  );
}

if (monoAvailable) {
  Font.register({
    family: "PlexMono",
    fonts: [
      { src: path.join(fontDir, "IBMPlexMono-Regular.ttf") },
      { src: path.join(fontDir, "IBMPlexMono-Medium.ttf"), fontWeight: 500 },
    ],
  });
} else {
  console.warn(
    "[MemberStatementDocument] IBM Plex Mono .ttf files not found in public/fonts — falling back to Courier for statement PDFs."
  );
}

if (serifAvailable) {
  Font.register({
    family: "SourceSerif",
    fonts: [
      { src: path.join(fontDir, "SourceSerif4-Regular.ttf") },
      { src: path.join(fontDir, "SourceSerif4-Bold.ttf"), fontWeight: 700 },
    ],
  });
} else {
  console.warn(
    "[MemberStatementDocument] Source Serif 4 .ttf files not found in public/fonts — falling back to Times-Roman for statement PDFs."
  );
}

// Small helpers so the rest of the file can keep saying "give me bold sans"
// without caring whether that resolves to a registered custom font (which
// uses fontWeight) or a react-pdf built-in (which needs a distinct family
// name per weight instead).
function sansStyle(weight: "regular" | "medium" | "bold" = "regular") {
  if (sansAvailable) {
    return { fontFamily: "PlexSans", fontWeight: weight === "regular" ? 400 : weight === "medium" ? 500 : 700 };
  }
  return { fontFamily: weight === "bold" ? "Helvetica-Bold" : "Helvetica" };
}
function monoStyle(weight: "regular" | "medium" = "regular") {
  if (monoAvailable) {
    return { fontFamily: "PlexMono", fontWeight: weight === "regular" ? 400 : 500 };
  }
  return { fontFamily: "Courier" };
}
function serifStyle(weight: "regular" | "bold" = "regular") {
  if (serifAvailable) {
    return { fontFamily: "SourceSerif", fontWeight: weight === "regular" ? 400 : 700 };
  }
  return { fontFamily: weight === "bold" ? "Times-Bold" : "Times-Roman" };
}

const INK = "#1c2b22";
const CREAM = "#faf6ec";
const PARCHMENT = "#eee7d6";
const GOLD = "#c9a24b";
const MUTED = "#4a5c50";

const styles = StyleSheet.create({
  page: {
    backgroundColor: CREAM,
    color: INK,
    ...sansStyle("regular"),
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: GOLD,
    paddingBottom: 12,
    marginBottom: 16,
  },
  saccoName: {
    ...serifStyle("bold"),
    fontSize: 16,
    color: INK,
  },
  saccoMeta: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  statementLabel: {
    ...serifStyle("regular"),
    fontSize: 13,
    color: INK,
    textAlign: "right",
  },
  statementMeta: {
    fontSize: 8,
    color: MUTED,
    textAlign: "right",
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: "row",
    marginBottom: 16,
  },
  infoCol: {
    flex: 1,
    backgroundColor: PARCHMENT,
    padding: 10,
    marginRight: 8,
    borderRadius: 2,
  },
  infoColLast: {
    marginRight: 0,
  },
  infoLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    ...monoStyle("regular"),
    fontSize: 9.5,
    color: INK,
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: GOLD,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: INK,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    ...sansStyle("bold"),
    color: CREAM,
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d8cfb8",
  },
  tableRowAlt: {
    backgroundColor: "#f4efe0",
  },
  cellDate: { width: "13%", fontSize: 8 },
  cellDesc: { width: "39%", fontSize: 8 },
  cellDebit: { width: "16%", fontSize: 8, ...monoStyle("regular"), textAlign: "right" },
  cellCredit: { width: "16%", fontSize: 8, ...monoStyle("regular"), textAlign: "right" },
  cellBalance: { width: "16%", fontSize: 8, ...monoStyle("medium"), textAlign: "right" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  summaryBox: {
    width: 220,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLineClosing: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: 2,
  },
  summaryLabel: { fontSize: 8.5, color: MUTED },
  summaryValue: { fontSize: 9.5, ...monoStyle("regular"), color: INK },
  summaryValueClosing: { fontSize: 10.5, ...monoStyle("medium"), color: INK },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: GOLD,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: MUTED },
  emptyState: {
    padding: 24,
    textAlign: "center",
    fontSize: 9,
    color: MUTED,
  },
});

export interface StatementTransaction {
  date: string; // ISO date
  description: string;
  debit: number | null;
  credit: number | null;
  balanceAfter: number;
}

export interface MemberStatementProps {
  saccoName: string;
  saccoRegNo?: string;
  member: {
    fullName: string;
    memberNumber: string;
    idNumber: string;
  };
  account: {
    // Free-text product label (e.g. "Regular Savings", "Share Capital",
    // "Development Loan") rather than a fixed enum, since SACCOs define
    // their own product names.
    accountType: string;
    accountNumber: string;
  };
  period: { startDate: string; endDate: string };
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactions: StatementTransaction[];
  generatedAt: string;
}

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemberStatementDocument(props: MemberStatementProps) {
  const {
    saccoName,
    saccoRegNo,
    member,
    account,
    period,
    openingBalance,
    closingBalance,
    totalDebits,
    totalCredits,
    transactions,
    generatedAt,
  } = props;

  return (
    <Document title={`${account.accountNumber} Statement`} author={saccoName}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow} fixed>
          <View>
            <Text style={styles.saccoName}>{saccoName}</Text>
            {saccoRegNo && <Text style={styles.saccoMeta}>SASRA Reg. No. {saccoRegNo}</Text>}
          </View>
          <View>
            <Text style={styles.statementLabel}>{account.accountType} Statement</Text>
            <Text style={styles.statementMeta}>
              {formatDate(period.startDate)} — {formatDate(period.endDate)}
            </Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Member</Text>
            <Text style={styles.infoValue}>{member.fullName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Member No.</Text>
            <Text style={styles.infoValue}>{member.memberNumber}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Account No.</Text>
            <Text style={styles.infoValue}>{account.accountNumber}</Text>
          </View>
          <View style={[styles.infoCol, styles.infoColLast]}>
            <Text style={styles.infoLabel}>Opening Balance</Text>
            <Text style={styles.infoValue}>{formatKES(openingBalance)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.tableHeaderCell, { width: "13%" }]}>Date</Text>
            <Text style={[styles.tableHeaderCell, { width: "39%" }]}>Description</Text>
            <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}>Debit</Text>
            <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}>Credit</Text>
            <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}>Balance</Text>
          </View>

          {transactions.length === 0 ? (
            <Text style={styles.emptyState}>No transactions were recorded for this period.</Text>
          ) : (
            transactions.map((tx, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={styles.cellDate}>{formatDate(tx.date)}</Text>
                <Text style={styles.cellDesc}>{tx.description}</Text>
                <Text style={styles.cellDebit}>{tx.debit ? formatKES(tx.debit) : "—"}</Text>
                <Text style={styles.cellCredit}>{tx.credit ? formatKES(tx.credit) : "—"}</Text>
                <Text style={styles.cellBalance}>{formatKES(tx.balanceAfter)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total debits</Text>
              <Text style={styles.summaryValue}>{formatKES(totalDebits)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total credits</Text>
              <Text style={styles.summaryValue}>{formatKES(totalCredits)}</Text>
            </View>
            <View style={styles.summaryLineClosing}>
              <Text style={styles.summaryLabel}>Closing balance</Text>
              <Text style={styles.summaryValueClosing}>{formatKES(closingBalance)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {formatDate(generatedAt)} — system-generated, no signature required</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}