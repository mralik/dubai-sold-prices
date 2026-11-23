// The full pipeline: question -> plan -> SQL -> statistics -> answer.

import Anthropic from "@anthropic-ai/sdk";
import { byPlace, monthlySeries, summarize, trendChange, type AreaSummary, type SeriesPoint, type Summary } from "./aggregate";
import { registrationSplit as buildRegistrationSplit, writeAnswer, type Answer, type RegistrationSplit } from "./answer";
import { AREAS } from "./areas";
import { claudePlan, CLAUDE_MODEL, estimateCostUsd, PlannerError } from "./claudePlanner";
import { compilePlan, ROW_LIMIT } from "./compile";
import { query } from "./db";
import { comparisonUnsupportedReason, demoPlan, filterIntentUnsupportedReason } from "./demoPlanner";
import { addMonths, describePlan, validatePlan, type QueryPlan } from "./plan";
import { DATA_INFO } from "./dataMode";
import type { SaleRecord } from "./sampleData";
import { LOW_SAMPLE_THRESHOLD } from "./thresholds";
import { resolvedPlacesForQuestion, type ResolvedPlace } from "./placeLabels";
import { projectSubtitle } from "./projectLabel";

export type PlannerMode = "claude" | "demo";

export interface AskResult {
  question: string;
  planner: { mode: PlannerMode; model: string | null; costUsd: number | null; note: string | null };
  plan: QueryPlan;
  interpretation: string[];
  placeLabels: string[];
  unsupported: string | null;
  sql: string | null;
  answer: Answer | null;
  summary: Summary | null;
  areas: AreaSummary[];
  series: SeriesPoint[];
  seriesKeys: string[];
  seriesCounts: Record<string, number>[];
  records: SaleRecord[];
  truncated: boolean;
  warnings: string[];
  dataAsOf: string;
  dataSourceLabel?: string;
  dataAttribution?: string;
  lowSample: boolean;
  registrationSplit: RegistrationSplit | null;
  timingMs: number;
}

const DAILY_LIMIT = Number(process.env.DAILY_CLAUDE_CALL_LIMIT ?? 50);
let usage = { day: "", calls: 0 };

export function plannerMode(): PlannerMode {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "demo";
}

function claudeAllowance(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) usage = { day: today, calls: 0 };
  if (usage.calls >= DAILY_LIMIT) return false;
  usage.calls++;
  return true;
}

function placeLabel(place: ResolvedPlace, rows: SaleRecord[]): string {
  if (place.kind !== "area") return place.label;
  const aliases = AREAS.find((area) => area.name === place.name)?.aliases ?? [];
  if (aliases.length > 0) return place.label;
  const subtitle = projectSubtitle(rows.filter((row) => row.area_name_en === place.name).map((row) => ({ master: row.master_project ?? "", project: row.project_name })));
  if (!subtitle) return place.label;
  const labels = subtitle.replace(/^mostly /, "").split(", ").filter((label) => label.toLowerCase() !== place.label.toLowerCase() && label.toLowerCase() !== place.name.toLowerCase());
  return labels.length > 0 ? `${place.label} · mostly ${labels.join(", ")}` : place.label;
}

function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export async function ask(question: string): Promise<AskResult> {
  const started = Date.now();
  let rawPlan: QueryPlan;
  let planner: AskResult["planner"] = { mode: "demo", model: null, costUsd: null, note: null };

  const comparisonReason = comparisonUnsupportedReason(question);
  if (comparisonReason) {
    rawPlan = { ...demoPlan("apartments in Dubai"), status: "unsupported", unsupportedReason: comparisonReason };
  } else if (plannerMode() === "claude" && claudeAllowance()) {
    try {
      const result = await claudePlan(question);
      rawPlan = result.plan;
      planner = { mode: "claude", model: result.model ?? CLAUDE_MODEL, costUsd: estimateCostUsd(result.usage), note: null };
    } catch (err) {
      // Fall back to the free reader so the app keeps working.
      rawPlan = demoPlan(question);
      planner.note = err instanceof PlannerError ? err.message
        : err instanceof Anthropic.RateLimitError ? "Claude is busy right now, so the built-in reader answered."
        : err instanceof Anthropic.APIError ? `Claude returned an error (${err.status ?? "network"}), so the built-in reader answered.`
        : "Claude couldn't be reached, so the built-in reader answered.";
    }
  } else {
    rawPlan = demoPlan(question);
    if (plannerMode() === "claude") planner.note = "Today's Claude limit was reached, so the built-in reader answered.";
  }

  const filterReason = rawPlan.status === "ok" ? filterIntentUnsupportedReason(question, rawPlan) : null;
  if (filterReason) rawPlan = { ...rawPlan, status: "unsupported", unsupportedReason: filterReason };

  const { plan, warnings } = validatePlan(rawPlan);
  if (DATA_INFO.mode === "dld" && plan.status === "ok" && plan.propertyType === "townhouse") {
    plan.propertyType = "villa";
    warnings.push("DLD records townhouses as villas, so this includes both.");
  }
  const resolvedPlaces = resolvedPlacesForQuestion(question, plan);
  const placeLabels = resolvedPlaces.map((place) => place.label);
  const base = {
    question, planner, plan, warnings, dataAsOf: DATA_INFO.latestTransactionDate,
    dataSourceLabel: DATA_INFO.sourceLabel, dataAttribution: DATA_INFO.attribution,
    placeLabels, interpretation: describePlan(plan, placeLabels),
    registrationSplit: null,
    areas: [] as AreaSummary[], series: [] as SeriesPoint[], seriesKeys: [] as string[], seriesCounts: [] as Record<string, number>[], records: [] as SaleRecord[],
  };

  if (plan.status === "unsupported") {
    return { ...base, unsupported: plan.unsupportedReason || "I can't answer that from sales data.", sql: null, answer: null, summary: null, lowSample: false, truncated: false, timingMs: Date.now() - started };
  }

  const { sql, recordsSql, params } = compilePlan(plan);
  const [rows, records] = await Promise.all([
    query<SaleRecord>(sql, params),
    query<SaleRecord>(recordsSql, params),
  ]);

  const summary = summarize(rows);
  const labels = resolvedPlaces.map((place) => placeLabel(place, rows));
  const areas = resolvedPlaces.length === 2 ? byPlace(rows, resolvedPlaces) : [];
  const { series, keys, counts } = monthlySeries(rows, plan, monthsInRange(plan.dateFrom, plan.dateTo), resolvedPlaces);
  const change: Record<string, number | null> = {};
  if (plan.groupBy === "month") {
    const enoughSales = keys.every((key) => counts.every((month) => (month[key] ?? 0) >= 10));
    if (!enoughSales) warnings.push("Not enough sales in some months to calculate a reliable month-on-month change.");
    for (const key of keys) change[key] = enoughSales ? trendChange(series, key) : null;
  }

  return {
    ...base,
    placeLabels: labels,
    interpretation: describePlan(plan, labels),
    registrationSplit: buildRegistrationSplit(rows, plan),
    unsupported: null,
    sql,
    answer: writeAnswer(plan, summary, areas, change, labels),
    summary,
    lowSample: summary.count > 0 && summary.count < LOW_SAMPLE_THRESHOLD,
    areas,
    series,
    seriesKeys: keys,
    seriesCounts: counts,
    records,
    truncated: rows.length > ROW_LIMIT,
    timingMs: Date.now() - started,
  };
}
