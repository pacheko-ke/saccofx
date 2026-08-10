import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SaccoFX Pro — Core banking for SACCOs",
  description:
    "One ledger for shares, savings, loans and dividends — built for Kenyan SACCOs.",
};

const LEDGER_ROWS = [
  { date: "03 Aug", particulars: "Monthly Contribution", debit: "", credit: "3,500.00", balance: "142,780.00" },
  { date: "05 Aug", particulars: "Loan Repayment — M. Wanjiru", debit: "", credit: "8,200.00", balance: "150,980.00" },
  { date: "07 Aug", particulars: "Dividend Payout FY25", debit: "62,000.00", credit: "", balance: "88,980.00" },
  { date: "10 Aug", particulars: "Share Capital — New Member", debit: "", credit: "5,000.00", balance: "93,980.00" },
];

const FEATURES = [
  {
    label: "Shares & Savings",
    title: "Every account, one source of truth",
    body: "Share capital, deposits and withdrawals post straight to a double-entry ledger — no end-of-day reconciliation.",
  },
  {
    label: "Loans",
    title: "From application to write-off",
    body: "Appraisal, disbursement, FIFO repayment allocation and PAR reporting, in a single lifecycle your credit committee can see.",
  },
  {
    label: "Payments",
    title: "M-Pesa and bank rails, native",
    body: "Daraja STK push, PesaLink and RTGS disbursement handled in-app, with statuses that update the ledger automatically.",
  },
  {
    label: "Compliance",
    title: "SASRA-ready, by default",
    body: "Trial balance, income statement and regulatory returns generate from the same books your tellers use daily.",
  },
];

const STEPS = [
  { mark: "Members", text: "Register members with KYC, next-of-kin and share capital in one form." },
  { mark: "Ledger", text: "Transactions post as balanced journal entries the moment they happen." },
  { mark: "Reports", text: "Trial balance, PAR and SASRA returns are always current, never rebuilt." },
];

export default function Home() {
  return (
    <div
      className={`${serif.variable} ${sans.variable} ${mono.variable} min-h-screen bg-[#F6F3EC] text-[#14231E]`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#D8CFBA]/70 bg-[#F6F3EC]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#0F2F26] text-[13px] font-semibold text-[#F6F3EC]" style={{ fontFamily: "var(--font-mono)" }}>
              S
            </span>
            <span className="text-[15px] font-semibold tracking-tight">SaccoFX Pro</span>
          </div>
          <nav className="hidden items-center gap-8 text-[14px] text-[#3D4F47] md:flex">
            <a href="#features" className="hover:text-[#0F2F26]">Platform</a>
            <a href="#ledger" className="hover:text-[#0F2F26]">The ledger</a>
            <a href="#how" className="hover:text-[#0F2F26]">How it works</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="#demo"
              className="hidden text-[14px] font-medium text-[#0F2F26] hover:text-[#B98A3D] sm:block"
            >
              Sign in
            </a>
            <a
              href="#demo"
              className="rounded-[3px] bg-[#0F2F26] px-4 py-2 text-[14px] font-medium text-[#F6F3EC] transition-colors hover:bg-[#153D32]"
            >
              Book a demo
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#D8CFBA]/70">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28">
          <div className="flex flex-col justify-center">
            <span
              className="mb-6 inline-flex w-fit items-center gap-2 rounded-[3px] border border-[#B98A3D]/40 bg-[#B98A3D]/10 px-3 py-1 text-[12px] font-medium tracking-wide text-[#8C6825]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              BUILT FOR KENYAN SACCOs
            </span>
            <h1
              className="text-[42px] leading-[1.08] tracking-tight text-[#0F2F26] md:text-[54px]"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            >
              One ledger for every share, saving and loan.
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-[#3D4F47]">
              SaccoFX Pro is core banking software for savings and credit cooperatives —
              member accounts, loans and M-Pesa payments, kept in a single balanced book.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#demo"
                className="rounded-[3px] bg-[#0F2F26] px-6 py-3 text-[15px] font-medium text-[#F6F3EC] transition-colors hover:bg-[#153D32]"
              >
                Book a demo
              </a>
              <a
                href="#features"
                className="text-[15px] font-medium text-[#0F2F26] underline decoration-[#B98A3D]/50 decoration-2 underline-offset-4 hover:decoration-[#B98A3D]"
              >
                See the platform
              </a>
            </div>
            <p className="mt-8 text-[13px] text-[#6B7F76]" style={{ fontFamily: "var(--font-mono)" }}>
              SASRA-aligned reporting · Daraja & PesaLink built in
            </p>
          </div>

          {/* Signature element: live passbook ledger */}
          <div className="relative flex items-center">
            <div className="relative w-full overflow-hidden rounded-[4px] border border-[#D8CFBA] bg-[#FFFDF8] shadow-[0_1px_0_#D8CFBA,0_18px_40px_-24px_rgba(15,47,38,0.35)]">
              {/* perforated edge */}
              <div className="absolute left-0 top-0 flex h-full w-4 flex-col items-center justify-around bg-[#0F2F26]/[0.04]">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#F6F3EC] ring-1 ring-[#D8CFBA]" />
                ))}
              </div>

              <div className="pl-9 pr-5 pt-6">
                <div className="flex items-baseline justify-between border-b border-[#D8CFBA] pb-3">
                  <span className="text-[13px] font-semibold text-[#0F2F26]" style={{ fontFamily: "var(--font-serif)" }}>
                    Member Passbook
                  </span>
                  <span className="text-[11px] text-[#8C6825]" style={{ fontFamily: "var(--font-mono)" }}>
                    A/C 0042-118
                  </span>
                </div>

                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-[#8A9A92]">
                      <th className="py-2 pr-2 font-medium">Date</th>
                      <th className="py-2 pr-2 font-medium">Particulars</th>
                      <th className="py-2 pr-2 text-right font-medium">Debit</th>
                      <th className="py-2 pr-2 text-right font-medium">Credit</th>
                      <th className="py-2 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontFamily: "var(--font-mono)" }}>
                    {LEDGER_ROWS.map((row, i) => (
                      <tr
                        key={row.date + i}
                        className="border-t border-dashed border-[#E4DDC9] opacity-0 [animation:ledger-row_0.5s_ease-out_forwards]"
                        style={{ animationDelay: `${180 + i * 140}ms` }}
                      >
                        <td className="py-2.5 pr-2 text-[#6B7F76]">{row.date}</td>
                        <td className="py-2.5 pr-2 text-[#14231E]">{row.particulars}</td>
                        <td className="py-2.5 pr-2 text-right text-[#8C4A2A]">{row.debit}</td>
                        <td className="py-2.5 pr-2 text-right text-[#2F6B4F]">{row.credit}</td>
                        <td className="py-2.5 text-right font-medium text-[#0F2F26]">{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between border-t border-[#D8CFBA] py-3 text-[11px] text-[#6B7F76]">
                  <span>Posted automatically as journal entries</span>
                  <span className="h-2 w-2 rounded-full bg-[#2F6B4F]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-[#D8CFBA]/70 bg-[#F6F3EC]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-lg">
            <h2
              className="text-[30px] leading-tight text-[#0F2F26]"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            >
              Everything the front office and the back office share.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#3D4F47]">
              Tellers, loan officers and finance work from the same books — so nothing needs
              reconciling at month end.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-[4px] border border-[#D8CFBA] bg-[#D8CFBA] sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-[#FFFDF8] p-8">
                <span
                  className="text-[11px] font-medium uppercase tracking-wide text-[#B98A3D]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {f.label}
                </span>
                <h3
                  className="mt-3 text-[19px] text-[#0F2F26]"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                >
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#3D4F47]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-[#D8CFBA]/70">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2
            className="text-[26px] text-[#0F2F26]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            From member registration to a closed set of books.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.mark} className="relative pl-6">
                <span
                  className="absolute left-0 top-1 text-[13px] text-[#B98A3D]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[15px] font-semibold text-[#0F2F26]">{s.mark}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#3D4F47]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" className="bg-[#0F2F26]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-16 md:flex-row md:items-center">
          <div>
            <h2
              className="text-[26px] text-[#F6F3EC] md:text-[30px]"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            >
              See your SACCO's books in SaccoFX Pro.
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#B9CBC2]">
              A 30-minute walkthrough with your own member and loan data, no obligation.
            </p>
          </div>
          <a
            href="mailto:hello@saccofxpro.co.ke?subject=Book%20a%20demo"
            className="shrink-0 rounded-[3px] bg-[#F6F3EC] px-7 py-3.5 text-[15px] font-medium text-[#0F2F26] transition-colors hover:bg-[#B98A3D] hover:text-[#0F2F26]"
          >
            Book a demo
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B241C] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-[13px] text-[#7C9186] sm:flex-row">
          <span>© {new Date().getFullYear()} SaccoFX Pro</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>Nairobi, Kenya</span>
        </div>
      </footer>

      <style>{`
        @keyframes ledger-row {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ledger-row"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}