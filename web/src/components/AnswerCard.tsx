import { AlertTriangle, FileCheck2, Info } from "lucide-react";
import type { AskResult } from "../api";
import { LOW_SAMPLE_WARNING, VERY_LOW_SAMPLE_WARNING } from "../../../server/thresholds";
import { aed, num } from "../format";

function primaryMetric(result: AskResult): string | null {
  if (!result.summary || result.summary.count === 0 || result.areas.length === 2) return null;
  if (result.plan.metric === "count") return `${num(result.summary.count)} sales`;
  if (result.plan.metric === "median_price_per_sqft") return result.summary.medianPricePerSqft === null ? null : `AED ${num(result.summary.medianPricePerSqft)} / sq ft`;
  return aed(result.summary.medianPrice);
}

export function AnswerCard({ result }: { result: AskResult }) {
  const { answer, warnings, planner, summary } = result;
  if (!answer) return null;
  const empty = summary?.count === 0;
  const phoneMetric = primaryMetric(result);
  return (
    <section className="card overflow-hidden" aria-labelledby="answer-heading">
      <div className="px-5 py-6 sm:px-8 sm:py-7">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-line/[0.03] px-2.5 py-1 font-semibold text-ink-300">
            {empty ? <Info className="size-3.5" aria-hidden /> : <FileCheck2 className="size-3.5" aria-hidden />}
            <span id="answer-heading">Market evidence</span>
          </span>
          <span className="truncate text-ink-400">“{result.question}”</span>
        </p>
        {phoneMetric && <p className="mt-4 font-display text-4xl leading-none font-extrabold tracking-tight text-gold-200 sm:hidden">{phoneMetric}</p>}
        <p className={`leading-relaxed text-pretty text-ink-100 ${phoneMetric ? "mt-3 text-base sm:mt-4 sm:font-display sm:text-3xl sm:leading-snug sm:font-semibold sm:tracking-tight" : "mt-4 font-display text-xl leading-snug font-semibold tracking-tight sm:text-3xl"}`}>{answer.headline}</p>
        {result.registrationSplit && (
          <ul className="mt-4 space-y-1 text-base text-ink-200 sm:text-lg">
            <li data-split-line="off-plan">{result.registrationSplit.offPlan.line}</li>
            <li data-split-line="ready">{result.registrationSplit.ready.line}</li>
          </ul>
        )}
        {answer.details.length > 0 && (
          <ul className="mt-4 space-y-2 text-ink-300">
            {answer.details.map((d) => (
              <li key={d} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-ink-500" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        )}
        {result.lowSample && (
          <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-3 text-sm text-ink-300" role="note">
            <p className="flex items-start gap-2 font-medium"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />{LOW_SAMPLE_WARNING}</p>
            {(summary?.count ?? 0) < 5 && <p className="mt-1 pl-6">{VERY_LOW_SAMPLE_WARNING}</p>}
          </div>
        )}
        {(warnings.length > 0 || planner.note) && (
          <ul className="mt-5 space-y-2">
            {[...(planner.note ? [planner.note] : []), ...warnings].map((w) => (
              <li key={w} className="flex items-start gap-2 rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2 text-sm text-ink-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
