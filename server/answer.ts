// Writes the plain-English answer from the computed statistics.
// It's deterministic on purpose: the numbers can't be made up.

import { summarize, type AreaSummary, type Summary } from "./aggregate";
import { periodLabel, ROOM_LABEL, type QueryPlan } from "./plan";
import type { SaleRecord } from "./sampleData";

export const formatAed = (n: number): string =>
  n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : `AED ${Math.round(n / 1000)}K`;

export const formatNumber = (n: number): string => n.toLocaleString("en-US");

function subject(plan: QueryPlan, area?: string, placeLabels: string[] = []): string {
  const type = plan.propertyType === "any" ? "properties" : `${plan.propertyType}s`;
  const rooms = plan.rooms === "any" ? "" : plan.rooms === "studio" ? "studio " : `${ROOM_LABEL[plan.rooms]} `;
  const reg = plan.registration === "any" ? "" : plan.registration === "off-plan" ? "off-plan " : "ready ";
  const where = area ?? (placeLabels.length ? placeLabels.join(" and ") : plan.areas.length ? plan.areas.join(" and ") : plan.communities.length ? plan.communities.join(" and ") : "all areas in the data");
  const what = plan.rooms === "studio" ? `${reg}studios` : `${reg}${rooms}${type}`;
  return `${what} in ${where}`;
}

const period = (plan: QueryPlan) => plan.dateFrom === plan.dateTo
  ? `in ${periodLabel(plan.dateFrom, plan.dateTo)}`
  : `between ${periodLabel(plan.dateFrom, plan.dateTo).replace(" – ", " and ")}`;

function metricSentence(plan: QueryPlan, s: Summary, area?: string, placeLabels: string[] = []): string {
  const who = subject(plan, area, placeLabels);
  if (s.count === 0) return `No sales matched ${who} ${period(plan)}.`;
  if (plan.metric === "count") return `There were ${formatNumber(s.count)} sales of ${who} ${period(plan)}.`;
  if (plan.metric === "median_price_per_sqft") {
    return `The median price for ${who} ${period(plan)} was AED ${formatNumber(s.medianPricePerSqft!)} per sq ft, from ${formatNumber(s.count)} sales.`;
  }
  return `The median sale price for ${who} ${period(plan)} was ${formatAed(s.medianPrice!)}, from ${formatNumber(s.count)} sales.`;
}

export interface Answer {
  headline: string;
  details: string[];
}

export function writeAnswer(plan: QueryPlan, summary: Summary, areas: AreaSummary[], change: Record<string, number | null>, placeLabels: string[] = []): Answer {
  const details: string[] = [];

  if (plan.groupBy === "area" && areas.length === 2) {
    const [a, b] = areas as [AreaSummary, AreaSummary];
    const key = plan.metric === "median_price" ? "medianPrice" : plan.metric === "median_price_per_sqft" ? "medianPricePerSqft" : "count";
    const va = a[key];
    const vb = b[key];
    if (typeof va === "number" && typeof vb === "number" && vb > 0) {
      const diff = Math.round(((va - vb) / vb) * 100);
      details.push(`${a.area} is ${Math.abs(diff)}% ${diff >= 0 ? "higher" : "lower"} than ${b.area} on this measure.`);
    }
    return { headline: compareSentence(plan, a, b), details: addTrends(details, change) };
  }

  const headline = metricSentence(plan, summary, undefined, placeLabels);
  if (summary.count >= 5 && plan.metric !== "count") {
    if (plan.metric === "median_price_per_sqft" && summary.psfP25 !== null && summary.psfP75 !== null) {
      details.push(`The middle half of sales were between AED ${formatNumber(summary.psfP25)} and AED ${formatNumber(summary.psfP75)} per sq ft.`);
    } else if (summary.priceP25 !== null && summary.priceP75 !== null) {
      details.push(`The middle half of sales were between ${formatAed(summary.priceP25)} and ${formatAed(summary.priceP75)}.`);
    }
  }
  return { headline, details: addTrends(details, change) };
}

function compareSentence(plan: QueryPlan, a: AreaSummary, b: AreaSummary): string {
  const fmt = (s: Summary) =>
    s.count === 0 ? "no sales"
      : plan.metric === "count" ? `${formatNumber(s.count)} sales`
      : plan.metric === "median_price_per_sqft" ? `AED ${formatNumber(s.medianPricePerSqft!)} per sq ft`
      : formatAed(s.medianPrice!);
  const measure = plan.metric === "count" ? "Number of sales" : plan.metric === "median_price_per_sqft" ? "Median price per sq ft" : "Median sale price";
  return `${measure} ${period(plan)}: ${a.area} ${fmt(a)}, ${b.area} ${fmt(b)}.`;
}

function addTrends(details: string[], change: Record<string, number | null>): string[] {
  for (const [key, pct] of Object.entries(change)) {
    if (pct === null) continue;
    const label = key === "value" ? "Over this period" : `In ${key}`;
    details.push(`${label}, the latest month was ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% from the previous month.`);
  }
  return details;
}

export interface RegistrationSide {
  count: number;
  median: number | null;
  line: string;
}

export interface RegistrationSplit {
  offPlan: RegistrationSide;
  ready: RegistrationSide;
}

/** Ready and off-plan medians, when the answer includes both and each has at least 10 sales. */
export function registrationSplit(rows: SaleRecord[], plan: QueryPlan): RegistrationSplit | null {
  if (plan.registration !== "any" || plan.metric === "count" || plan.groupBy === "area" || rows.length === 0) return null;
  const offPlan = summarize(rows.filter((row) => row.registration === "off-plan"));
  const ready = summarize(rows.filter((row) => row.registration === "ready"));
  if (offPlan.count < 10 || ready.count < 10) return null;
  const line = (label: string, summary: Summary) => {
    const median = plan.metric === "median_price_per_sqft"
      ? `AED ${formatNumber(summary.medianPricePerSqft!)} per sq ft`
      : formatAed(summary.medianPrice!);
    return `${label} · ${median} · ${formatNumber(summary.count)} sales`;
  };
  const medianOf = (summary: Summary) => plan.metric === "median_price_per_sqft" ? summary.medianPricePerSqft : summary.medianPrice;
  return {
    offPlan: { count: offPlan.count, median: medianOf(offPlan), line: line("Off-plan", offPlan) },
    ready: { count: ready.count, median: medianOf(ready), line: line("Ready", ready) },
  };
}
