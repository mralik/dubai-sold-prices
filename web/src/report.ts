import type { AskResult } from "./api";
import type { QueryPlan } from "../../server/plan";
import type { SaleRecord } from "../../server/sampleData";
import { sourceTextLines } from "./dataSource";
import { aed, monthLong, num } from "./format";

export interface AgentDetails {
  name: string;
  agency: string;
  note: string;
}

const pluralType = (type: QueryPlan["propertyType"]): string => {
  if (type === "any") return "homes";
  return `${type}s`;
};

const subject = (plan: QueryPlan): string => {
  const type = pluralType(plan.propertyType);
  if (plan.rooms === "studio") return plan.propertyType === "apartment" || plan.propertyType === "any" ? "studios" : `studio ${type}`;
  if (plan.rooms !== "any") return `${plan.rooms}-bedroom ${type}`;
  return type;
};

export function buildReportTitle(plan: QueryPlan, placeLabels: string[] = []): string {
  const place = placeLabels.length ? placeLabels.join(" and ") : plan.areas.length ? plan.areas.join(" and ") : plan.communities.length ? plan.communities.join(" and ") : "Dubai";
  return `Sales evidence: ${subject(plan)} in ${place}, ${reportPeriod(plan)}`;
}

export function reportPeriod(plan: Pick<QueryPlan, "dateFrom" | "dateTo">): string {
  return plan.dateFrom === plan.dateTo ? monthLong(plan.dateFrom) : `${monthLong(plan.dateFrom)} – ${monthLong(plan.dateTo)}`;
}

export function selectComparables(records: SaleRecord[], limit = 10): SaleRecord[] {
  if (limit <= 0) return [];
  return [...records]
    .sort((a, b) => b.instance_date.localeCompare(a.instance_date) || b.transaction_id.localeCompare(a.transaction_id))
    .slice(0, limit);
}

export function buildWhatsAppSummary(result: AskResult, agent: Pick<AgentDetails, "name" | "agency">): string {
  const summary = result.summary;
  if (!summary || summary.count === 0) return "";
  const preparedBy = agent.agency.trim() ? `${agent.name.trim()}, ${agent.agency.trim()}` : agent.name.trim();
  return [
    buildReportTitle(result.plan, result.placeLabels),
    `Median price: ${aed(summary.medianPrice)}`,
    `Median per sq ft: ${summary.medianPricePerSqft === null ? "–" : `AED ${num(summary.medianPricePerSqft)}`}`,
    `Sales: ${num(summary.count)}`,
    `Period: ${reportPeriod(result.plan)}`,
    `Prepared by: ${preparedBy}`,
    ...sourceTextLines(result.dataAttribution),
  ].join("\n");
}
