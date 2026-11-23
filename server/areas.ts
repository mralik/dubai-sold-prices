// Areas in the sample dataset, with the nicknames people actually type.
//
// The price levels below are rough, made-up values used only to generate
// realistic-looking sample data. They are NOT real Dubai Land Department figures.

export type PropertyType = "apartment" | "villa" | "townhouse";

export interface AreaDefinition {
  name: string;
  aliases: string[];
}

export interface AreaConfig extends AreaDefinition {
  name: string;
  aliases: string[];
  /** Relative number of sales per month. */
  volume: number;
  /** Sample price per sq ft (AED) by property type, at the start of 2024. */
  pricePerSqft: Partial<Record<PropertyType, number>>;
  /** Share of sales that are off-plan, from 0 to 1. */
  offPlanShare: number;
}

export const SAMPLE_AREAS: AreaConfig[] = [
  { name: "Downtown Dubai", aliases: ["downtown", "burj khalifa area"], volume: 6, pricePerSqft: { apartment: 2700 }, offPlanShare: 0.35 },
  { name: "Business Bay", aliases: ["business bay", "bb"], volume: 8, pricePerSqft: { apartment: 2000 }, offPlanShare: 0.55 },
  { name: "Dubai Marina", aliases: ["marina"], volume: 8, pricePerSqft: { apartment: 2050 }, offPlanShare: 0.25 },
  { name: "Jumeirah Village Circle", aliases: ["jvc"], volume: 14, pricePerSqft: { apartment: 1150, townhouse: 1050 }, offPlanShare: 0.6 },
  { name: "Jumeirah Lake Towers", aliases: ["jlt"], volume: 6, pricePerSqft: { apartment: 1450 }, offPlanShare: 0.2 },
  { name: "Palm Jumeirah", aliases: ["palm", "the palm"], volume: 4, pricePerSqft: { apartment: 3600, villa: 5200 }, offPlanShare: 0.4 },
  { name: "Dubai Hills Estate", aliases: ["dubai hills"], volume: 7, pricePerSqft: { apartment: 2100, villa: 2600, townhouse: 1900 }, offPlanShare: 0.45 },
  { name: "Dubai Creek Harbour", aliases: ["creek harbour", "creek harbor", "dubai creek"], volume: 5, pricePerSqft: { apartment: 2150 }, offPlanShare: 0.65 },
  { name: "Arabian Ranches", aliases: ["ranches"], volume: 3, pricePerSqft: { villa: 1550, townhouse: 1450 }, offPlanShare: 0.3 },
  { name: "DAMAC Hills 2", aliases: ["damac hills 2", "dh2", "akoya"], volume: 5, pricePerSqft: { villa: 950, townhouse: 900 }, offPlanShare: 0.5 },
  { name: "International City", aliases: ["intl city", "international city"], volume: 5, pricePerSqft: { apartment: 780 }, offPlanShare: 0.15 },
  { name: "Al Barsha", aliases: ["barsha"], volume: 3, pricePerSqft: { apartment: 1300 }, offPlanShare: 0.2 },
  { name: "Mohammed Bin Rashid City", aliases: ["mbr city", "mbr", "meydan"], volume: 5, pricePerSqft: { apartment: 2000, villa: 2400 }, offPlanShare: 0.6 },
  { name: "Dubai South", aliases: ["dubai south", "expo city area"], volume: 5, pricePerSqft: { apartment: 1050, townhouse: 1100 }, offPlanShare: 0.65 },
];

import aliasFile from "./areaAliases.json";
import { DATA_MODE, DLD_METADATA } from "./dataMode";

const dldAliases = aliasFile as Record<string, string[]>;
export const AREAS: AreaDefinition[] = DATA_MODE === "dld" && DLD_METADATA
  ? DLD_METADATA.areas.map((name) => ({ name, aliases: dldAliases[name] ?? [] }))
  : SAMPLE_AREAS;

export const AREA_NAMES = AREAS.map((a) => a.name) as [string, ...string[]];

const byLowerName = new Map(AREAS.map((a) => [a.name.toLowerCase(), a.name]));

/** Returns the official area name for a name or nickname, or null if unknown. */
export function canonicalArea(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (byLowerName.has(key)) return byLowerName.get(key)!;
  for (const area of AREAS) {
    if (area.aliases.includes(key)) return area.name;
  }
  return null;
}

/** Every name and nickname, longest first, for matching inside free text. */
export const AREA_PATTERNS: { pattern: string; name: string }[] = AREAS.flatMap((a) =>
  [a.name, ...a.aliases].map((p) => ({ pattern: p.toLowerCase(), name: a.name })),
).sort((x, y) => y.pattern.length - x.pattern.length);
