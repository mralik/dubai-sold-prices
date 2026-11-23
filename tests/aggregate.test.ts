import { describe, expect, it } from "vitest";
import { byPlace, monthlySeries, percentile, trendChange } from "../server/aggregate";
import type { ResolvedPlace } from "../server/placeLabels";
import type { QueryPlan } from "../server/plan";
import type { SaleRecord } from "../server/sampleData";

describe("percentile", () => {
  it("finds the median of odd and even lists", () => {
    expect(percentile([1, 2, 3], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("place grouping", () => {
  const row = (id: string, area: string, master: string): SaleRecord => ({ transaction_id: id, instance_date: "2026-10-10", area_name_en: area, master_project: master, project_name: "Test", property_type: "apartment", rooms: "1", registration: "ready", size_sqft: 700, price_aed: 1_000_000, price_per_sqft: 1429 });
  const rows = [row("1", "Area A", "Community X"), row("2", "Area B", "Community Y"), row("3", "Area C", "Community Z")];
  const area = (name: string): ResolvedPlace => ({ kind: "area", name, label: name, index: 0, values: [name] });
  const community = (name: string, value: string): ResolvedPlace => ({ kind: "community", name, label: name, index: 0, values: [value] });
  const plan: QueryPlan = { status: "ok", unsupportedReason: "", areas: [], communities: [], propertyType: "any", rooms: "any", registration: "any", dateFrom: "2026-10", dateTo: "2026-10", metric: "count", groupBy: "area" };

  it.each([
    ["area + community", [area("Area A"), community("Community Y", "Community Y")]],
    ["community + community", [community("Community X", "Community X"), community("Community Y", "Community Y")]],
    ["area + area", [area("Area A"), area("Area B")]],
  ] as const)("groups %s comparisons by the requested places", (_label, places) => {
    expect(byPlace(rows, [...places]).map((summary) => summary.count)).toEqual([1, 1]);
    const monthly = monthlySeries(rows, plan, ["2026-10"], [...places]);
    expect(monthly.keys).toEqual(places.map((place) => place.label));
    expect(monthly.counts[0]).toEqual(Object.fromEntries(places.map((place) => [place.label, 1])));
  });
});

describe("trendChange", () => {
  it("compares the latest month with the previous month", () => {
    const series = [100, 100, 100, 110, 110, 110].map((v, i) => ({ month: `2025-0${i + 1}`, value: v }));
    expect(trendChange(series, "value")).toBe(0);
  });
  it("needs at least 2 months of data", () => {
    expect(trendChange([{ month: "2025-01", value: 1 }], "value")).toBeNull();
  });
});
