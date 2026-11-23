import { AlertTriangle, Check, Copy, ExternalLink, Printer, X } from "lucide-react";
import { useState } from "react";
import type { AskResult } from "../api";
import { aed, dateShort, num, roomsLabel } from "../format";
import { buildReportTitle, buildWhatsAppSummary, selectComparables, type AgentDetails } from "../report";
import { DLD_SOURCE_URL, isDldData } from "../dataSource";
import { SourceCredit } from "./Footer";
import { ShareCardButton } from "./ShareCardButton";
import { TrendChart } from "./TrendChart";
import { LOW_SAMPLE_WARNING, VERY_LOW_SAMPLE_WARNING } from "../../../server/thresholds";

interface Props {
  result: AskResult;
  agent: AgentDetails;
  onClose: () => void;
}

export default function ReportView({ result, agent, onClose }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const summary = result.summary!;
  const title = buildReportTitle(result.plan, result.placeLabels);
  const text = buildWhatsAppSummary(result, agent);
  const comparables = selectComparables(result.records);
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const psfRange = result.plan.metric === "median_price_per_sqft";
  const middleHalf = psfRange
    ? summary.psfP25 !== null && summary.psfP75 !== null ? `AED ${num(summary.psfP25)} – AED ${num(summary.psfP75)} / sq ft` : "–"
    : summary.priceP25 !== null && summary.priceP75 !== null ? `${aed(summary.priceP25)} – ${aed(summary.priceP75)}` : "–";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="report-overlay fixed inset-0 z-50 overflow-y-auto bg-night-900 px-3 pt-3 pb-24 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="client-report-title">
      <div className="report-toolbar mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onClose} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-line/10 bg-night-850 px-3 text-sm text-ink-300 hover:bg-line/5">
          <X className="size-4" aria-hidden /> Close
        </button>
        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
          <button type="button" onClick={() => void copy()} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-line/10 bg-night-850 px-3 text-sm font-medium text-ink-300 hover:bg-line/5">
            {copyState === "copied" ? <Check className="size-4 text-gulf-300" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            Copy WhatsApp summary
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-gulf-400/30 bg-gulf-400/10 px-3 text-sm font-medium text-gulf-300 hover:bg-gulf-400/15">
            Open in WhatsApp <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <ShareCardButton result={result} tone="quiet" />
          <button type="button" onClick={() => window.print()} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl bg-gold-400 px-3 text-sm font-semibold text-night-950 hover:bg-gold-300">
            <Printer className="size-4" aria-hidden /> Print / Save PDF
          </button>
        </div>
      </div>

      <p className={`report-copy-status fixed right-3 bottom-20 z-[60] rounded-lg bg-night-850 px-3 py-2 text-xs text-ink-300 shadow-lg transition sm:static sm:mx-auto sm:mb-2 sm:max-w-[210mm] sm:bg-transparent sm:p-0 sm:text-right sm:shadow-none ${copyState === "idle" ? "pointer-events-none opacity-0" : "opacity-100"}`} aria-live="polite">
        {copyState === "copied" ? "Summary copied." : copyState === "failed" ? "Could not copy. Check browser clipboard permission." : ""}
      </p>

      <article className="report-paper mx-auto max-w-[210mm] bg-white px-5 py-7 text-slate-900 shadow-2xl sm:px-10 sm:py-10">
        <header className="report-block flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase">Dubai Sold Prices</p>
            <p className="mt-2 text-xl font-bold">{agent.name}</p>
            {agent.agency && <p className="text-sm text-slate-600">{agent.agency}</p>}
          </div>
          <div className="text-right">
            <span className="inline-flex rounded-full border border-amber-700/25 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-800 uppercase">{result.dataSourceLabel ?? "Sample data"}</span>
            <p className="mt-2 text-sm font-medium text-slate-600">Created {date}</p>
          </div>
        </header>

        <section className="report-block py-7">
          <h1 id="client-report-title" className="text-xl leading-tight font-bold sm:text-2xl">{title}</h1>
          <div className={`mt-6 grid grid-cols-2 gap-3 ${summary.count < 5 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
            {[
              ["Median price", aed(summary.medianPrice)],
              ["Median per sq ft", summary.medianPricePerSqft === null ? "–" : `AED ${num(summary.medianPricePerSqft)}`],
              ["Sales", num(summary.count)],
              ...(summary.count >= 5 ? [["Middle half", middleHalf]] : []),
            ].map(([label, value]) => (
              <div key={label} className="report-card border-t border-slate-300 py-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {label === "Middle half" && !psfRange && summary.priceP25 !== null && summary.priceP75 !== null ? (
                    <><span className="whitespace-nowrap">{aed(summary.priceP25)}</span><span> – </span><span className="whitespace-nowrap">{aed(summary.priceP75)}</span></>
                  ) : value}
                </p>
              </div>
            ))}
          </div>
          {result.lowSample && (
            <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950" role="note">
              <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{LOW_SAMPLE_WARNING}</p>
              {summary.count < 5 && <p className="mt-1 pl-6">{VERY_LOW_SAMPLE_WARNING}</p>}
            </div>
          )}
          {result.warnings.map((warning) => (
            <p key={warning} className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="note">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{warning}
            </p>
          ))}
        </section>

        {result.series.length >= 2 && (
          <div className="report-chart border-y border-slate-200 py-5">
            <TrendChart result={result} printMode />
          </div>
        )}

        <section className="mt-7">
          <h2 className="text-lg font-bold">Comparable sales</h2>
          <p className="mt-1 text-sm text-slate-500">The ten most recent matching records available to this report.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 font-semibold">Area · project</th><th className="px-2 py-2 font-semibold">Type</th><th className="px-2 py-2 text-right font-semibold">Size</th><th className="px-2 py-2 text-right font-semibold">Price</th><th className="px-2 py-2 text-right font-semibold">Per sq ft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparables.map((record) => (
                  <tr key={record.transaction_id}>
                    <td className="px-2 py-2 whitespace-nowrap">{dateShort(record.instance_date)}</td>
                    <td className="px-2 py-2"><span className="font-semibold">{record.area_name_en}</span><span className="block text-slate-500">{record.project_name}</span></td>
                    <td className="px-2 py-2 whitespace-nowrap capitalize">{record.property_type} · {roomsLabel(record.rooms)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{num(record.size_sqft)} sq ft</td>
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{aed(record.price_aed)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">AED {num(record.price_per_sqft)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-block mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="font-bold">How this was calculated</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {result.interpretation.map((part) => <li key={part} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs">{part}</li>)}
          </ul>
          <p className="mt-3 text-sm text-slate-600">Figures use medians calculated from the registered sales matching these filters.</p>
        </section>

        {agent.note && (
          <section className="report-block mt-7 border-l-4 border-amber-500 pl-4">
            <h2 className="font-bold">Note from {agent.name}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{agent.note}</p>
          </section>
        )}

        <footer className="report-block mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
          Market evidence, not a valuation. Data through {result.dataAsOf}.{" "}
          {isDldData(result.dataAttribution) ? (
            // The URL is also printed in full, so a paper copy still points to the source.
            <><SourceCredit linkClassName="underline underline-offset-2" /> {DLD_SOURCE_URL}</>
          ) : (result.dataAttribution ?? "Synthetic data for demonstration only.")}
        </footer>
      </article>

      <div className="report-mobile-actions fixed inset-x-0 bottom-0 z-[55] grid grid-cols-4 gap-2 border-t border-line/10 bg-night-900/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
        <button type="button" onClick={() => void copy()} className="focus-ring inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-line/10 bg-night-850 text-xs font-medium text-ink-300">
          {copyState === "copied" ? <Check className="size-4 text-gulf-300" aria-hidden /> : <Copy className="size-4" aria-hidden />} Copy
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-gulf-400/30 bg-gulf-400/10 text-xs font-medium text-gulf-300">
          <ExternalLink className="size-4" aria-hidden /> WhatsApp
        </a>
        <ShareCardButton result={result} tone="compact" />
        <button type="button" onClick={() => window.print()} className="focus-ring inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-gold-400 text-xs font-semibold text-night-950">
          <Printer className="size-4" aria-hidden /> Save PDF
        </button>
      </div>
    </div>
  );
}
