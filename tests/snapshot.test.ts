import { describe, expect, it } from "vitest";
import { summarize } from "../server/aggregate";
import { communityValues } from "../server/communities";
import { query } from "../server/db";
import { DATA_INFO } from "../server/dataMode";
import { demoPlan } from "../server/demoPlanner";
import { displayName } from "../server/displayName";
import { addMonths } from "../server/plan";
import type { SaleRecord } from "../server/sampleData";
import { choosePlaceRows, classifySegments, getSnapshot, likeForLikeChange, rankPriceChanges, type MixSale, type SnapshotChange, type SnapshotPlace } from "../server/snapshot";

function asSales(rows: { price_aed: number; price_per_sqft: number; size_sqft: number }[]): SaleRecord[] {
  return rows.map((row, index) => ({
    transaction_id: String(index),
    instance_date: "2026-10-01",
    area_name_en: "",
    project_name: "",
    property_type: "apartment",
    rooms: "1",
    registration: "ready",
    size_sqft: Number(row.size_sqft),
    price_aed: Number(row.price_aed),
    price_per_sqft: Number(row.price_per_sqft),
  }));
}

async function mix(place: Pick<SnapshotPlace, "kind" | "officialName">, from: string, to: string) {
  const params = place.kind === "area" ? [place.officialName] : communityValues([place.officialName]);
  const column = place.kind === "area" ? "area_name_en = ?" : `master_project IN (${params.map(() => "?").join(", ")})`;
  const rows = await query<{ registration: string; property_type: string; rooms: string; price_per_sqft: number }>(
    `SELECT registration, property_type, rooms, price_per_sqft FROM sales WHERE ${column} AND instance_date >= ? AND instance_date < ?`,
    [...params, `${from}-01`, `${addMonths(to, 1)}-01`],
  );
  return rows.map((row) => ({
    registration: String(row.registration),
    propertyType: String(row.property_type),
    rooms: String(row.rooms),
    pricePerSqft: Number(row.price_per_sqft),
  }));
}

async function direct(place: Pick<SnapshotPlace, "kind" | "officialName">, from: string, to: string) {
  const params = place.kind === "area" ? [place.officialName] : communityValues([place.officialName]);
  const column = place.kind === "area" ? "area_name_en = ?" : `master_project IN (${params.map(() => "?").join(", ")})`;
  const rows = await query<{ price_aed: number; price_per_sqft: number; size_sqft: number }>(
    `SELECT price_aed, price_per_sqft, size_sqft FROM sales WHERE ${column} AND instance_date >= ? AND instance_date < ?`,
    [...params, `${from}-01`, `${addMonths(to, 1)}-01`],
  );
  return summarize(asSales(rows));
}

const candidate = (name: string, recentSales: number, priorSales: number, changePct: number, coveragePct = 100): SnapshotChange => ({
  name,
  subtitle: null,
  officialName: name,
  kind: "area",
  changePct,
  recentMedianPsf: 1000,
  priorMedianPsf: 900,
  recentSales,
  priorSales,
  segmentsUsed: 1,
  coveragePct,
  propertyType: "apartment",
  rooms: "1",
  registration: "ready",
  question: name,
});

function copies(count: number, registration: string, propertyType: string, rooms: string, pricePerSqft: number): MixSale[] {
  return Array.from({ length: count }, () => ({ registration, propertyType, rooms, pricePerSqft }));
}

describe("snapshot", () => {
  it("matches a direct query for the busiest area and for one price change", async () => {
    const snapshot = await getSnapshot();
    expect(snapshot.month).toBe(DATA_INFO.to);
    expect(snapshot.monthLabel).toBe("October 2026");
    expect(snapshot.periods.recent).toEqual({ from: addMonths(DATA_INFO.to, -2), to: DATA_INFO.to });
    expect(snapshot.periods.prior).toEqual({ from: addMonths(DATA_INFO.to, -5), to: addMonths(DATA_INFO.to, -3) });

    const busiest = snapshot.busiest[0];
    expect(busiest).toBeTruthy();
    const directBusiest = await direct(busiest!, snapshot.periods.latest.from, snapshot.periods.latest.to);
    expect(busiest!.sales).toBe(directBusiest.count);
    expect(busiest!.medianPrice).toBe(directBusiest.medianPrice);
    expect(busiest!.sparkline).toHaveLength(6);

    const change = snapshot.rising[0] ?? snapshot.falling[0];
    expect(change).toBeTruthy();
    const recentMix = await mix(change!, snapshot.periods.recent.from, snapshot.periods.recent.to);
    const priorMix = await mix(change!, snapshot.periods.prior.from, snapshot.periods.prior.to);
    const like = likeForLikeChange(recentMix, priorMix);
    expect(like).not.toBeNull();
    expect(change!.recentSales).toBe(like!.recentSales);
    expect(change!.priorSales).toBe(like!.priorSales);
    expect(change!.recentMedianPsf).toBe(like!.recentMedianPsf);
    expect(change!.priorMedianPsf).toBe(like!.priorMedianPsf);
    expect(change!.changePct).toBe(like!.changePct);
    expect(change!.segmentsUsed).toBe(like!.segmentsUsed);
    expect(change!.coveragePct).toBe(like!.coveragePct);
    expect(change!.coveragePct).toBeGreaterThanOrEqual(60);
    expect(change!.segmentsUsed).toBeGreaterThan(0);
    expect(change!.subtitle).toContain(like!.segmentLabel);

    const plan = demoPlan(change!.question);
    expect(plan.status).toBe("ok");
    expect(plan.propertyType).toBe(change!.propertyType);
    expect(plan.rooms).toBe(change!.rooms);
    expect(plan.registration).toBe(change!.registration);
    expect(plan.dateFrom).toBe(snapshot.periods.prior.from);
    expect(plan.dateTo).toBe(snapshot.periods.recent.to);
    const places = [...plan.areas, ...plan.communities].map((place) => place.toLowerCase());
    expect(places.some((place) => change!.question.toLowerCase().includes(place.toLowerCase()) || place.toLowerCase().includes(change!.officialName.toLowerCase()))).toBe(true);

    expect(displayName("Al Barsha South Fourth", ["jvc", "jumeirah village circle"])).toBe("JVC");
    expect(displayName("Marsa Dubai", ["marina", "dubai marina"])).toBe("Dubai Marina");
    expect(displayName("Jumeirah Village Circle", ["jvc"])).toBe("JVC");
    expect(displayName("Palm Deira", ["deira islands"])).toBe("Deira Islands");
    expect(displayName("Palm Jumeirah", ["palm", "the palm"])).toBe("Palm Jumeirah");
    expect(displayName("Wadi Al Safa 3", ["majan"])).toBe("Majan");
    expect(displayName("Business Bay", ["bb"])).toBe("Business Bay");
  });

  it("leaves out places with fewer than 30 sales in either period", () => {
    const ranked = rankPriceChanges([
      candidate("Thin recent", 29, 80, 12),
      candidate("Thin prior", 80, 29, -6),
      candidate("Just enough", 30, 30, 4),
      candidate("No change", 40, 40, 0),
    ]);
    expect(ranked.rising.map((place) => place.name)).toEqual(["Just enough"]);
    expect(ranked.falling).toEqual([]);
    expect([...ranked.rising, ...ranked.falling].every((place) => place.recentSales >= 30 && place.priorSales >= 30)).toBe(true);
  });

  it("shows a rise when each segment rises but the mix makes the raw median fall", () => {
    const prior = [...copies(30, "ready", "apartment", "1", 400), ...copies(70, "off-plan", "apartment", "1", 1000)];
    const recent = [...copies(70, "ready", "apartment", "1", 500), ...copies(30, "off-plan", "apartment", "1", 1100)];
    const rawPrior = summarize(asSales(prior.map((sale) => ({ price_aed: sale.pricePerSqft, price_per_sqft: sale.pricePerSqft, size_sqft: 1 })))).medianPricePerSqft;
    const rawRecent = summarize(asSales(recent.map((sale) => ({ price_aed: sale.pricePerSqft, price_per_sqft: sale.pricePerSqft, size_sqft: 1 })))).medianPricePerSqft;
    expect(rawRecent!).toBeLessThan(rawPrior!);
    const like = likeForLikeChange(recent, prior);
    expect(like).not.toBeNull();
    expect(like!.changePct).toBe(25);
    expect(like!.segmentLabel).toBe("ready 1-bed apartments");
    expect(like!.segmentsUsed).toBe(2);
    expect(like!.coveragePct).toBe(100);
  });

  it("lists an 8x jump as a new launch, not as rising", () => {
    const prior = copies(10, "off-plan", "villa", "4", 1000);
    const recent = copies(80, "off-plan", "villa", "4", 2000);
    const split = classifySegments(recent, prior);
    expect(split.launches.map((segment) => segment.recentSales)).toEqual([80]);
    expect(split.price).toEqual([]);
    expect(likeForLikeChange([...recent, ...copies(30, "ready", "apartment", "1", 500)], [...prior, ...copies(30, "ready", "apartment", "1", 400)])).toBeNull();
    expect(rankPriceChanges([]).rising).toEqual([]);
  });

  it("drops a place when the matched segments cover under 60% of either period", () => {
    const covered = [
      ...copies(60, "ready", "apartment", "1", 800),
    ];
    const recentOnly = copies(40, "off-plan", "villa", "4", 1500);
    const priorOnly = copies(40, "ready", "townhouse", "3", 900);
    const atSixty = likeForLikeChange([...covered, ...recentOnly], [...covered, ...priorOnly]);
    expect(atSixty?.coveragePct).toBe(60);
    expect(atSixty?.changePct).toBe(0);

    const justUnder = likeForLikeChange(
      [...copies(59, "ready", "apartment", "1", 800), ...copies(41, "off-plan", "villa", "4", 1500)],
      [...copies(59, "ready", "apartment", "1", 880), ...copies(41, "ready", "townhouse", "3", 900)],
    );
    expect(justUnder).toBeNull();

    const onePeriodShort = likeForLikeChange(
      [...copies(80, "ready", "apartment", "1", 800), ...copies(20, "off-plan", "villa", "4", 1500)],
      [...copies(50, "ready", "apartment", "1", 880), ...copies(50, "ready", "townhouse", "3", 900)],
    );
    expect(onePeriodShort).toBeNull();
    expect(likeForLikeChange(copies(29, "ready", "apartment", "1", 800), copies(40, "ready", "apartment", "1", 880))).toBeNull();
    expect(rankPriceChanges([candidate("Thin coverage", 80, 80, 8, 59.9)]).rising).toEqual([]);
  });

  it("prefers a community that is most of an area, and does not list both", () => {
    const area = { kind: "area" as const, officialName: "Jabal Ali First", name: "Jabal Ali First", sales: 100 };
    const community = { kind: "community" as const, officialName: "Al Furjan", name: "Al Furjan", sales: 80 };
    const other = { kind: "area" as const, officialName: "Business Bay", name: "Business Bay", sales: 90 };
    const share = new Map([["Jabal Ali First", { community: "Al Furjan", share: 0.8 }]]);
    const inside = new Map([["Jabal Ali First", ["Al Furjan"]]]);
    expect(choosePlaceRows([area, community, other], share, inside, 5).map((row) => row.name)).toEqual(["Business Bay", "Al Furjan"]);

    const partial = new Map([["Jabal Ali First", { community: "Al Furjan", share: 0.4 }]]);
    const smaller = { ...community, sales: 40 };
    expect(choosePlaceRows([area, smaller, other], partial, inside, 5).map((row) => row.name)).toEqual(["Jabal Ali First", "Business Bay"]);
  });
});
