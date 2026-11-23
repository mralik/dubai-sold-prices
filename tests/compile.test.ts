import { describe, expect, it } from "vitest";
import { compilePlan } from "../server/compile";
import type { QueryPlan } from "../server/plan";

const base: QueryPlan = {
  status: "ok", unsupportedReason: "", areas: [], communities: [], propertyType: "any", rooms: "any",
  registration: "any", dateFrom: "2026-05", dateTo: "2026-10", metric: "median_price", groupBy: "none",
};

describe("compilePlan", () => {
  it("uses placeholders for every value and an exclusive upper date", () => {
    const { sql, params } = compilePlan({ ...base, areas: ["Dubai Marina"], rooms: "2", propertyType: "apartment", registration: "ready" });
    expect(params).toEqual(["2026-05-01", "2026-11-01", "Dubai Marina", "apartment", "2", "ready"]);
    expect(sql).not.toContain("Dubai Marina");
    expect(sql.match(/\?/g)).toHaveLength(params.length);
  });

  it("rolls the year over for December", () => {
    expect(compilePlan({ ...base, dateFrom: "2025-01", dateTo: "2025-12" }).params.slice(0, 2)).toEqual(["2025-01-01", "2026-01-01"]);
  });

  it("compiles community master-project values as parameters", () => {
    const { sql, params } = compilePlan({ ...base, communities: ["JLT"] });
    expect(sql).toContain("master_project IN (?)");
    expect(params.slice(-1)).toEqual(["DMCC Master Community"]);
  });

  it("combines an area and a community with OR", () => {
    const { sql, params } = compilePlan({ ...base, areas: ["Al Barsha South Fourth"], communities: ["JLT"] });
    expect(sql).toContain("(area_name_en IN (?) OR master_project IN (?))");
    expect(params.slice(-2)).toEqual(["Al Barsha South Fourth", "DMCC Master Community"]);
  });

  it("never puts plan text into the SQL, even if it looks malicious", () => {
    const evil = { ...base, areas: ["x'); DROP TABLE sales;--"] } as QueryPlan;
    const { sql } = compilePlan(evil);
    expect(sql).not.toMatch(/DROP/i);
    expect(sql.trim().toUpperCase().startsWith("SELECT")).toBe(true);
  });

  it("refuses unsupported plans", () => {
    expect(() => compilePlan({ ...base, status: "unsupported" })).toThrow();
  });
});
