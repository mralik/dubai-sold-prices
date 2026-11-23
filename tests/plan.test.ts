import { describe, expect, it } from "vitest";
import { addMonths, validatePlan } from "../server/plan";

const ok = {
  status: "ok", unsupportedReason: "", areas: ["Dubai Marina"], communities: [], propertyType: "any", rooms: "any",
  registration: "any", dateFrom: "2025-01", dateTo: "2025-12", metric: "median_price", groupBy: "none",
};

describe("validatePlan", () => {
  it("accepts a good plan", () => {
    expect(validatePlan(ok).warnings).toEqual([]);
  });
  it("rejects unknown areas at the schema level", () => {
    expect(() => validatePlan({ ...ok, areas: ["Atlantis City"] })).toThrow();
  });
  it("clamps dates to the data range and warns", () => {
    const { plan, warnings } = validatePlan({ ...ok, dateFrom: "2020-01", dateTo: "2030-12" });
    expect(plan.dateFrom).toBe("2024-01");
    expect(plan.dateTo).toBe("2026-10");
    expect(warnings.length).toBeGreaterThan(0);
  });
  it("swaps reversed dates", () => {
    const { plan } = validatePlan({ ...ok, dateFrom: "2025-12", dateTo: "2025-01" });
    expect([plan.dateFrom, plan.dateTo]).toEqual(["2025-01", "2025-12"]);
  });
  it("drops area grouping when only one area is given", () => {
    expect(validatePlan({ ...ok, groupBy: "area" }).plan.groupBy).toBe("none");
  });
});

describe("addMonths", () => {
  it("handles year boundaries", () => {
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", -11)).toBe("2025-11");
  });
});
