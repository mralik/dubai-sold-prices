// Text on the share card, copied from the answer. No statistics are recalculated here.

import type { AskResult } from "./api";
import { LOW_SAMPLE_THRESHOLD } from "../../server/thresholds";

export const APP_NAME = "Dubai Sold Prices";
export { DLD_SOURCE_LINE } from "./dataSource";
import { DLD_SOURCE_URL, DLD_SOURCE_URL_SHORT, sourceTextLines } from "./dataSource";

export interface CardColors {
  bg: string;
  bgDeep: string;
  ink: string;
  muted: string;
  soft: string;
  gold: string;
  gulf: string;
  line: string;
  skyTop: string;
  skyBottom: string;
  skyEdge: string;
  skyLight: string;
  skyGlow: string;
  noteBg: string;
}

export const CARD_COLORS: Record<"light" | "dark", CardColors> = {
  light: {
    bg: "#faf7f1",
    bgDeep: "#f3ecdf",
    ink: "#121827",
    muted: "#5b6479",
    soft: "#3b4459",
    gold: "#a98242",
    gulf: "#0e8c7f",
    line: "rgba(42, 34, 20, 0.12)",
    skyTop: "#e7d7b8",
    skyBottom: "#f6efe2",
    skyEdge: "#a98242",
    skyLight: "#a98242",
    skyGlow: "#c4a266",
    noteBg: "rgba(169, 130, 66, 0.12)",
  },
  dark: {
    bg: "#070b16",
    bgDeep: "#10182b",
    ink: "#eef1f7",
    muted: "#8e99b3",
    soft: "#b7c0d4",
    gold: "#cbb47b",
    gulf: "#3fd3bd",
    line: "rgba(255, 255, 255, 0.12)",
    skyTop: "#1a2540",
    skyBottom: "#0b1120",
    skyEdge: "#b89452",
    skyLight: "#cbb47b",
    skyGlow: "#b89452",
    noteBg: "rgba(203, 180, 123, 0.12)",
  },
};

export function canShareCard(result: AskResult): boolean {
  return result.unsupported === null && (result.summary?.count ?? 0) > 0;
}

export function cardPlaceName(label: string): string {
  const match = /^(.*) \([^()]+\)$/.exec(label);
  return match?.[1] ?? label;
}

export function cardPlaces(result: AskResult): string[] {
  const labels = result.areas.length === 2 ? result.areas.map((area) => area.area) : result.placeLabels;
  if (labels.length === 0) return ["Dubai"];
  return labels.map(cardPlaceName);
}

export function cardFilters(result: AskResult): string {
  const { rooms, propertyType, registration } = result.plan;
  const bedrooms = rooms === "any" ? "Any bedrooms" : rooms === "studio" ? "Studios" : `${rooms}-bedroom`;
  const type = propertyType === "any" ? "All property types" : `${propertyType[0]!.toUpperCase()}${propertyType.slice(1)}s`;
  const status = registration === "any" ? "Off-plan and ready" : registration === "off-plan" ? "Off-plan" : "Ready";
  return `${bedrooms} · ${type} · ${status}`;
}

export function cardPeriod(result: AskResult): string {
  const format = (ym: string) => {
    const [year, month] = ym.split("-").map(Number) as [number, number];
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  };
  const { dateFrom, dateTo } = result.plan;
  return dateFrom === dateTo ? format(dateFrom) : `${format(dateFrom)} – ${format(dateTo)}`;
}

export function cardSourceLines(result: AskResult): string[] {
  // An image can't hold a link, so the card prints a short form of the URL.
  return sourceTextLines(result.dataAttribution).map((line) => (line === DLD_SOURCE_URL ? DLD_SOURCE_URL_SHORT : line));
}

export function comparisonCallout(result: AskResult): { pctLabel: string; sentence: string } | null {
  const sentence = result.answer?.details.find((line) => /\d+% (higher|lower) than /.test(line));
  if (!sentence) return null;
  const match = /^(.+) is (\d+)% (higher|lower) than (.+) on this measure\.$/.exec(sentence);
  if (!match) return { pctLabel: "", sentence };
  return { pctLabel: `${match[3] === "higher" ? "+" : "−"}${match[2]}%`, sentence };
}

export function trendSeries(result: AskResult): { key: string; values: (number | null)[] }[] {
  if (result.series.length < 2) return [];
  return result.seriesKeys
    .map((key) => ({
      key,
      values: result.series.map((point) => (typeof point[key] === "number" ? point[key] : null)),
    }))
    .filter((series) => series.values.filter((value) => value !== null).length >= 2);
}

export function showLowSample(result: AskResult): boolean {
  if (result.lowSample) return true;
  return result.areas.some((area) => area.count > 0 && area.count < LOW_SAMPLE_THRESHOLD);
}
