import { describe, expect, it } from "vitest";
import type { AskResult } from "../web/src/api";
import { buildReportTitle, buildWhatsAppSummary, selectComparables } from "../web/src/report";
import { DLD_SOURCE_LINE, DLD_SOURCE_URL, NOT_AFFILIATED_LINE } from "../web/src/dataSource";
import type { QueryPlan } from "../server/plan";
import type { SaleRecord } from "../server/sampleData";

const plan = (overrides: Partial<QueryPlan> = {}): QueryPlan => ({
  status: "ok",
  unsupportedReason: "",
  areas: ["Jumeirah Village Circle"],
  communities: [],
  propertyType: "apartment",
  rooms: "2",
  registration: "any",
  dateFrom: "2026-05",
  dateTo: "2026-10",
  metric: "median_price",
  groupBy: "none",
  ...overrides,
});

const record = (id: string, date: string): SaleRecord => ({
  transaction_id: id,
  instance_date: date,
  area_name_en: "Jumeirah Village Circle",
  project_name: "Sample Tower",
  property_type: "apartment",
  rooms: "2",
  registration: "ready",
  size_sqft: 1200,
  price_aed: 1_500_000,
  price_per_sqft: 1250,
});

const result = (count = 12): AskResult => ({
  question: "test",
  planner: { mode: "demo", model: null, costUsd: null, note: null },
  plan: plan(),
  interpretation: [],
  placeLabels: [],
  unsupported: null,
  sql: "SELECT 1",
  answer: null,
  summary: count ? { count, medianPrice: 1_500_000, medianPricePerSqft: 1250, priceP25: 1_300_000, priceP75: 1_700_000, psfP25: 1100, psfP75: 1400, medianSizeSqft: 1200 } : { count: 0, medianPrice: null, medianPricePerSqft: null, priceP25: null, priceP75: null, psfP25: null, psfP75: null, medianSizeSqft: null },
  areas: [],
  series: [],
  seriesKeys: [],
  seriesCounts: [],
  records: [],
  truncated: false,
  warnings: [],
  dataAsOf: "2026-10",
  lowSample: count > 0 && count < 10,
  registrationSplit: null,
  timingMs: 10,
});

describe("agent report helpers", () => {
  it("builds a specific report title", () => {
    expect(buildReportTitle(plan())).toBe("Sales evidence: 2-bedroom apartments in Jumeirah Village Circle, May 2026 – October 2026");
  });

  it("describes studios naturally", () => {
    expect(buildReportTitle(plan({ rooms: "studio" }))).toContain("Sales evidence: studios in Jumeirah Village Circle");
  });

  it("shows a single month without repeating it", () => {
    expect(buildReportTitle(plan({ dateFrom: "2026-10", dateTo: "2026-10" }))).toContain(", October 2026");
    expect(buildReportTitle(plan({ dateFrom: "2026-10", dateTo: "2026-10" }))).not.toContain("October 2026 – October 2026");
  });

  it("selects at most ten newest comparables", () => {
    const records = Array.from({ length: 12 }, (_, i) => record(String(i), `2026-${String((i % 12) + 1).padStart(2, "0")}-01`));
    const selected = selectComparables(records);
    expect(selected).toHaveLength(10);
    expect(selected[0]?.instance_date).toBe("2026-12-01");
  });

  it("handles an empty comparable list and empty result", () => {
    expect(selectComparables([])).toEqual([]);
    expect(buildWhatsAppSummary(result(0), { name: "Ali", agency: "" })).toBe("");
  });

  it("builds a six-line WhatsApp summary", () => {
    const text = buildWhatsAppSummary(result(), { name: "Ali", agency: "Sample Realty" });
    expect(text.split("\n")).toHaveLength(6);
    expect(text).toContain("Median price: AED 1.5M");
    expect(text).toContain("Prepared by: Ali, Sample Realty");
  });

  it("adds the DLD source, link and not-affiliated line for real data", () => {
    const text = buildWhatsAppSummary({ ...result(), dataAttribution: DLD_SOURCE_LINE }, { name: "Ali", agency: "" });
    expect(text).toContain(DLD_SOURCE_LINE);
    expect(text).toContain(DLD_SOURCE_URL);
    expect(text).toContain(NOT_AFFILIATED_LINE);
  });
});
