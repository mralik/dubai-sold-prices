// The query plan: the only thing the AI is allowed to produce.
//
// The AI never writes SQL. It fills in this plan, the plan is checked here,
// and compile.ts turns it into safe, parameterised SQL.

import { z } from "zod";
import { AREA_NAMES, canonicalArea } from "./areas";
import { DATA_INFO } from "./dataMode";
import { canonicalCommunity } from "./communities";

const DATA_START = DATA_INFO.from;
const DATA_END = DATA_INFO.to;

export const QueryPlanSchema = z.object({
  status: z.enum(["ok", "unsupported"]).describe("Use 'unsupported' when the data can't answer the question."),
  unsupportedReason: z.string().describe("Short reason when status is 'unsupported'; empty string otherwise."),
  areas: z.array(z.enum(AREA_NAMES)).describe("0 to 2 areas. Empty means all areas in the dataset."),
  communities: z.array(z.string()).max(2).describe("0 to 2 exact communities. Empty means all communities."),
  propertyType: z.enum(["any", "apartment", "villa", "townhouse"]),
  rooms: z.enum(["any", "studio", "1", "2", "3", "4", "5+"]),
  registration: z.enum(["any", "off-plan", "ready"]),
  dateFrom: z.string().describe("First month included, format YYYY-MM."),
  dateTo: z.string().describe("Last month included, format YYYY-MM."),
  metric: z.enum(["median_price", "median_price_per_sqft", "count"]),
  groupBy: z.enum(["none", "month", "area"]),
});

export type QueryPlan = z.infer<typeof QueryPlanSchema>;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Adds n months to YYYY-MM (n can be negative). */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The default period when a question doesn't name one: the full available range. */
export const defaultDateRange = () => ({ dateFrom: DATA_START, dateTo: DATA_END });

export interface PlanCheck {
  plan: QueryPlan;
  warnings: string[];
}

/**
 * Checks and tidies a plan from any source (Claude or the built-in reader).
 * Throws if the plan can't be used.
 */
export function validatePlan(input: unknown): PlanCheck {
  const parsed = QueryPlanSchema.safeParse(input);
  if (!parsed.success) throw new Error("The question couldn't be turned into a valid query plan.");
  const plan = { ...parsed.data };
  const warnings: string[] = [];

  if (plan.status === "unsupported") return { plan, warnings };

  plan.areas = [...new Set(plan.areas.map((a) => canonicalArea(a)).filter((a): a is string => a !== null))].slice(0, 2);
  plan.communities = [...new Set(plan.communities.map((community) => canonicalCommunity(community)).filter((community): community is string => community !== null))].slice(0, 2);
  if (plan.areas.length + plan.communities.length > 2) plan.communities = plan.communities.slice(0, Math.max(0, 2 - plan.areas.length));

  if (!MONTH.test(plan.dateFrom) || !MONTH.test(plan.dateTo)) {
    Object.assign(plan, defaultDateRange());
    warnings.push("I couldn't read the dates, so I used the last 12 months.");
  }
  if (plan.dateFrom > plan.dateTo) [plan.dateFrom, plan.dateTo] = [plan.dateTo, plan.dateFrom];
  if (plan.dateFrom < DATA_START) {
    plan.dateFrom = DATA_START;
    warnings.push(`The data starts in ${monthLabel(DATA_START)}.`);
  }
  if (plan.dateTo > DATA_END) {
    plan.dateTo = DATA_END;
    warnings.push(`The latest data is from ${monthLabel(DATA_END)}.`);
  }
  if (plan.dateFrom > DATA_END || plan.dateTo < DATA_START) {
    Object.assign(plan, defaultDateRange());
    warnings.push("That period is outside the data, so I used the last 12 months.");
  }
  if (plan.groupBy === "area" && plan.areas.length + plan.communities.length < 2) plan.groupBy = "none";
  if (plan.groupBy === "month" && DATA_START === DATA_END) {
    warnings.push(`Trends need more than one month of data. The current data covers ${monthLongLabel(DATA_START)}.`);
  }

  return { plan, warnings };
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function monthLongLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function periodLabel(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? monthLongLabel(dateFrom) : `${monthLongLabel(dateFrom)} – ${monthLongLabel(dateTo)}`;
}

const ROOM_LABEL: Record<QueryPlan["rooms"], string> = {
  any: "any size", studio: "studios", "1": "1-bedroom", "2": "2-bedroom", "3": "3-bedroom", "4": "4-bedroom", "5+": "5+ bedroom",
};

/** A human-readable summary of how the question was read, shown to the user. */
export function describePlan(plan: QueryPlan, placeLabels: string[] = []): string[] {
  if (plan.status === "unsupported") return [];
  const parts = [
    placeLabels.length ? placeLabels.join(" vs ") : plan.areas.length ? plan.areas.join(" vs ") : plan.communities.length ? plan.communities.join(" vs ") : "All areas",
    plan.propertyType === "any" ? "All property types" : `${plan.propertyType[0]!.toUpperCase()}${plan.propertyType.slice(1)}s`,
    plan.rooms === "any" ? "Any size" : ROOM_LABEL[plan.rooms][0]!.toUpperCase() + ROOM_LABEL[plan.rooms].slice(1),
    plan.registration === "any" ? "Off-plan and ready" : plan.registration === "off-plan" ? "Off-plan only" : "Ready only",
    periodLabel(plan.dateFrom, plan.dateTo),
    plan.metric === "median_price" ? "Median price" : plan.metric === "median_price_per_sqft" ? "Median price per sq ft" : "Number of sales",
  ];
  if (plan.groupBy === "month") parts.push("Month by month");
  return parts;
}

export { ROOM_LABEL };
