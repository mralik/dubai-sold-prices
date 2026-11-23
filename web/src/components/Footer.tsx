import type { Meta } from "../api";
import { monthLong } from "../format";
import { DLD_SOURCE_URL, NOT_AFFILIATED_LINE } from "../dataSource";
import { Logo } from "./Header";

/** Source credit with a link to the original data, as the data.dubai licence asks. */
export function SourceCredit({ linkClassName = "font-medium text-ink-300 underline decoration-gold-400/40 underline-offset-2 transition-colors hover:text-gold-400" }: { linkClassName?: string }) {
  return (
    <>
      Source: Dubai Land Department, via{" "}
      <a href={DLD_SOURCE_URL} target="_blank" rel="noopener" className={linkClassName}>data.dubai</a>{" "}
      (Open Data License). {NOT_AFFILIATED_LINE}
    </>
  );
}

export function Footer({ meta }: { meta: Meta | null }) {
  return (
    <footer className="relative border-t border-line/[0.06] bg-night-950/80 py-10 text-sm text-ink-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <Logo />
          <div>
            <p className="font-display font-bold text-ink-100">Dubai Sold Prices</p>
            <p className="font-arabic text-xs text-ink-500" lang="ar" dir="rtl">أسعار بيع العقارات في دبي</p>
          </div>
        </div>
        <div className="max-w-xl space-y-2 text-xs leading-relaxed">
          {meta?.sampleData ? (
            <p><strong className="font-semibold text-ink-300">Demo with sample data.</strong> All figures are synthetic and for illustration only; the sample runs to {monthLong(meta.dataTo)}.</p>
          ) : (
            <>
              <p><strong className="font-semibold text-ink-300">{meta?.dataSourceLabel ?? "DLD data"}.</strong> Coverage {meta ? `${monthLong(meta.dataFrom)}–${monthLong(meta.dataTo)}` : ""}; latest included transaction {meta?.latestTransactionDate ?? "–"}.</p>
              <p><SourceCredit /></p>
            </>
          )}
          <p>For information only, not a valuation, financial advice or investment advice.</p>
          <p>
            © {new Date().getFullYear()} Built by Ali Kalantari ·{" "}
            <a
              href="https://thealik.com"
              target="_blank"
              rel="noopener"
              className="font-medium text-ink-300 underline decoration-gold-400/40 underline-offset-2 transition-colors hover:text-gold-400"
            >
              thealik.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
