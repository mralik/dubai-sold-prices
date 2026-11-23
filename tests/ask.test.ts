import { describe, expect, it } from "vitest";
import { ask } from "../server/ask";
import { filterIntentUnsupportedReason } from "../server/demoPlanner";
import { query } from "../server/db";
import { placeLabelsForQuestion } from "../server/placeLabels";
import type { QueryPlan } from "../server/plan";
import { displayName } from "../server/displayName";

describe("ask (demo reader, sample data)", () => {
  it("answers with numbers that match a direct SQL query", async () => {
    const result = await ask("2-bed apartments in JVC in 2025");
    const [direct] = await query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sales WHERE area_name_en = ? AND property_type = ? AND rooms = ? AND instance_date >= ? AND instance_date < ?",
      ["Jumeirah Village Circle", "apartment", "2", "2025-01-01", "2026-01-01"],
    );
    expect(result.summary?.count).toBe(direct!.n);
    expect(result.answer?.headline).toContain(direct!.n.toLocaleString("en-US"));
  });

  it("declines questions the data can't answer", async () => {
    const result = await ask("What is the rent for a studio in JLT?");
    expect(result.unsupported).toBeTruthy();
    expect(result.sql).toBeNull();
  });

  it("does not silently drop an unknown place", async () => {
    const result = await ask("Prices in Narnia Heights");
    expect(result.unsupported).toContain("I don't recognise 'Narnia Heights' yet.");
    expect(result.summary).toBeNull();
  });

  it("still recognises JLT in sample mode", async () => {
    const result = await ask("How much did apartments in JLT sell for?");
    expect(result.unsupported).toBeNull();
    expect(result.plan.areas).toEqual(["Jumeirah Lake Towers"]);
  });

  it("compares two areas", async () => {
    const result = await ask("Compare Downtown and Business Bay 1-bed prices in 2025");
    expect(result.areas.map((a) => a.area)).toEqual(["Downtown (Downtown Dubai)", "Business Bay"]);
    expect(result.answer?.headline).toMatch(/Downtown \(Downtown Dubai\).*Business Bay/);
  });

  it("treats lately as a time phrase, not a place", async () => {
    const result = await ask("What did 2 bedroom flats go for lately?");
    expect(result.unsupported).toBeNull();
    expect(result.plan.areas).toEqual([]);
    expect(result.plan.dateFrom).toBe("2026-05");
    expect(result.plan.dateTo).toBe("2026-10");
  });

  it("treats Dubai as all areas", async () => {
    const result = await ask("Apartments in Dubai");
    expect(result.unsupported).toBeNull();
    expect(result.plan.areas).toEqual([]);
    expect(result.plan.communities).toEqual([]);
  });

  it("uses canonical capitalization for community labels", async () => {
    const plan: QueryPlan = { status: "ok", unsupportedReason: "", areas: [], communities: ["Discovery Gardens"], propertyType: "apartment", rooms: "studio", registration: "any", dateFrom: "2026-01", dateTo: "2026-10", metric: "median_price", groupBy: "none" };
    expect(placeLabelsForQuestion("studios in discovery gardens", plan)).toEqual(["Discovery Gardens"]);
  });

  it("calculates an all-areas median from more than 20,000 matching rows", async () => {
    const result = await ask("Sales in all areas");
    const prices = await query<{ price: number }>("SELECT price_aed AS price FROM sales ORDER BY price_aed");
    expect(prices.length).toBeGreaterThan(20_000);
    const middle = prices.length / 2;
    const directMedian = prices.length % 2 ? prices[Math.floor(middle)]!.price : (prices[middle - 1]!.price + prices[middle]!.price) / 2;
    expect(result.summary?.count).toBe(prices.length);
    expect(result.summary?.medianPrice).toBe(Math.round(directMedian));
  });

  it("declines comparisons with more than two places without dropping one", async () => {
    const result = await ask("Compare Dubai Marina, JLT and JVC");
    expect(result.unsupported).toBe("I can compare up to 2 places at a time. Try 'Compare Dubai Marina and JVC'.");
    expect(result.summary).toBeNull();
  });

  it("groups a two-place comparison by place", async () => {
    const result = await ask("Dubai Marina vs JVC 1-bed prices");
    expect(result.plan.groupBy).toBe("area");
    expect(result.areas).toHaveLength(2);
    expect(result.registrationSplit).toBeNull();
  });

  it("declines property-type comparisons without silently selecting one", async () => {
    const result = await ask("Dubai Hills villas vs townhouses");
    expect(result.unsupported).toBe("I can answer one property type at a time. Ask about villas and townhouses separately, or leave the type out to include both.");
    expect(result.summary).toBeNull();
  });

  it.each(["2-3 bed apartments in JVC", "2–3 bed apartments in JVC", "2 to 3 bedroom flats in JLT", "2 through 3 bed apartments in JVC"])("declines bedroom range %s", async (question) => {
    const result = await ask(question);
    expect(result.unsupported).toBe("I can answer one bedroom count at a time. Ask about 2-beds and 3-beds separately, or leave the bedrooms out to include all.");
  });

  it("names the property types that were asked", async () => {
    const result = await ask("apartments and villas in Dubai Hills");
    expect(result.unsupported).toBe("I can answer one property type at a time. Ask about apartments and villas separately, or leave the type out to include both.");
  });

  it("does not resolve a numbered place to the unnumbered place", async () => {
    const result = await ask("Villas in Arabian Ranches 3 last year");
    expect(result.plan.areas).not.toContain("Arabian Ranches");
  });

  it.each([
    ["villas and townhouses in Arabian Ranches 3", "I can answer one property type at a time. Ask about villas and townhouses separately, or leave the type out to include both."],
    ["compare studios and 1 beds in JVC", "I can answer one bedroom count at a time. Ask about studios and 1-beds separately, or leave the bedrooms out to include all."],
    ["1 or 2 bed apartments in JVC", "I can answer one bedroom count at a time. Ask about 1-beds and 2-beds separately, or leave the bedrooms out to include all."],
  ])("does not silently drop a filter in %s", async (question, message) => {
    const result = await ask(question);
    expect(result.unsupported).toBe(message);
    expect(result.summary).toBeNull();
  });

  it("treats off-plan and ready together as no registration filter", async () => {
    expect(filterIntentUnsupportedReason("off-plan and ready villas in Damac Hills")).toBeNull();
    const result = await ask("off-plan and ready villas in DAMAC Hills 2");
    expect(result.unsupported).toBeNull();
    expect(result.plan.propertyType).toBe("villa");
    expect(result.plan.registration).toBe("any");
  });

  it.each([
    "2-bed in Al Furjan",
    "Villas in Arabian Ranches 3 last year",
    "Town Square 2 bed",
    "studios in discovery gardens",
    "Compare JLT and JVC 1-bed prices",
  ])("does not mistake a place name for a filter in %s", (question) => {
    expect(filterIntentUnsupportedReason(question)).toBeNull();
  });

  it("uses Dubai Marina as the friendly label for Marsa Dubai", async () => {
    expect(displayName("Marsa Dubai", ["marina", "dubai marina"])).toBe("Dubai Marina");
  });

  it("uses per-square-foot quartiles for a per-square-foot answer", async () => {
    const result = await ask("price per sqft palm jumeirah 3 bed this year");
    expect(result.answer?.details.join(" ")).toMatch(/AED [\d,]+ and AED [\d,]+ per sq ft/);
    expect(result.summary?.psfP25).not.toBeNull();
    expect(result.summary?.psfP75).not.toBeNull();
  });
});
