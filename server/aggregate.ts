// Turns matching sales into statistics. All numbers shown to the user come from
// here, never from the AI.

import type { SaleRecord } from "./sampleData";
import type { QueryPlan } from "./plan";
import { saleMatchesPlace, type ResolvedPlace } from "./placeLabels";

export interface Summary {
  count: number;
  medianPrice: number | null;
  medianPricePerSqft: number | null;
  priceP25: number | null;
  priceP75: number | null;
  psfP25: number | null;
  psfP75: number | null;
  medianSizeSqft: number | null;
}

export interface SeriesPoint {
  month: string;
  [areaOrValue: string]: number | string | null;
}

export interface AreaSummary extends Summary {
  area: string;
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (idx - lo);
}

const sortedBy = (rows: SaleRecord[], key: "price_aed" | "price_per_sqft" | "size_sqft") =>
  rows.map((r) => r[key]).sort((x, y) => x - y);

export function summarize(rows: SaleRecord[]): Summary {
  const prices = sortedBy(rows, "price_aed");
  const psf = sortedBy(rows, "price_per_sqft");
  const sizes = sortedBy(rows, "size_sqft");
  return {
    count: rows.length,
    medianPrice: round(percentile(prices, 0.5)),
    medianPricePerSqft: round(percentile(psf, 0.5)),
    priceP25: round(percentile(prices, 0.25)),
    priceP75: round(percentile(prices, 0.75)),
    psfP25: round(percentile(psf, 0.25)),
    psfP75: round(percentile(psf, 0.75)),
    medianSizeSqft: round(percentile(sizes, 0.5)),
  };
}

const round = (n: number | null) => (n === null ? null : Math.round(n));

function metricValue(rows: SaleRecord[], metric: QueryPlan["metric"]): number | null {
  if (metric === "count") return rows.length;
  if (rows.length === 0) return null;
  const s = summarize(rows);
  return metric === "median_price" ? s.medianPrice : s.medianPricePerSqft;
}

/**
 * Monthly values for the chart. One series per area when comparing two areas,
 * otherwise a single "value" series. Months with no sales are kept, as null.
 */
export function monthlySeries(rows: SaleRecord[], plan: QueryPlan, months: string[], places: ResolvedPlace[] = []): { series: SeriesPoint[]; keys: string[]; counts: Record<string, number>[] } {
  const metric = plan.metric;
  const effectivePlaces = places.length ? places : plan.areas.map((area) => ({ kind: "area" as const, name: area, label: area, index: 0, values: [area] }));
  const keys = effectivePlaces.length === 2 ? effectivePlaces.map((place) => place.label) : ["value"];
  const buckets = new Map<string, SaleRecord[]>();
  for (const r of rows) {
    const rowKeys = effectivePlaces.length === 2 ? effectivePlaces.filter((place) => saleMatchesPlace(r, place)).map((place) => place.label) : ["value"];
    for (const rowKey of rowKeys) {
      const key = `${r.instance_date.slice(0, 7)}|${rowKey}`;
      const list = buckets.get(key);
      if (list) list.push(r);
      else buckets.set(key, [r]);
    }
  }
  const series = months.map((month) => {
    const point: SeriesPoint = { month };
    for (const key of keys) point[key] = metricValue(buckets.get(`${month}|${key}`) ?? [], metric);
    return point;
  });
  const counts = months.map((month) => Object.fromEntries(keys.map((key) => [key, buckets.get(`${month}|${key}`)?.length ?? 0])));
  return { series, keys, counts };
}

export function byArea(rows: SaleRecord[], areas: string[]): AreaSummary[] {
  return areas.map((area) => ({ area, ...summarize(rows.filter((r) => r.area_name_en === area)) }));
}

export function byPlace(rows: SaleRecord[], places: ResolvedPlace[]): AreaSummary[] {
  return places.map((place) => ({ area: place.label, ...summarize(rows.filter((row) => saleMatchesPlace(row, place))) }));
}

/** Percentage change from the previous month to the latest month. */
export function trendChange(series: SeriesPoint[], key: string): number | null {
  const values = series.map((p) => p[key]).filter((v): v is number => typeof v === "number");
  if (values.length < 2) return null;
  const previous = values.at(-2)!;
  const latest = values.at(-1)!;
  return previous === 0 ? null : Math.round(((latest - previous) / previous) * 1000) / 10;
}
