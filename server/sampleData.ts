// Generates a realistic-looking SAMPLE of Dubai property sales.
//
// Every value here is synthetic. The same seed always produces the same rows,
// so tests stay stable. It is the default data mode, so the app runs without
// downloading anything. Set DATA_MODE=dld to use the real DLD data instead.

import { SAMPLE_AREAS, type PropertyType } from "./areas";

export type Rooms = "studio" | "1" | "2" | "3" | "4" | "5+" | "unknown";
export type Registration = "off-plan" | "ready";

export interface SaleRecord {
  transaction_id: string;
  instance_date: string; // YYYY-MM-DD
  area_name_en: string;
  master_project?: string;
  project_name: string;
  property_type: PropertyType;
  rooms: Rooms;
  registration: Registration;
  size_sqft: number;
  price_aed: number;
  price_per_sqft: number;
}

/** The sample covers Jan 2024 to Oct 2026. */
export const DATA_START = "2024-01";
export const DATA_END = "2026-10";

// Size ranges in sq ft by property type and rooms.
const SIZES: Record<PropertyType, Partial<Record<Rooms, [number, number]>>> = {
  apartment: { studio: [380, 520], "1": [680, 880], "2": [1050, 1400], "3": [1550, 2000], "4": [2400, 3400] },
  townhouse: { "2": [1350, 1700], "3": [1850, 2350], "4": [2500, 3100] },
  villa: { "3": [2300, 2900], "4": [3100, 4300], "5+": [4500, 9000] },
};

// How common each room count is, by property type.
const ROOM_WEIGHTS: Record<PropertyType, [Rooms, number][]> = {
  apartment: [["studio", 18], ["1", 38], ["2", 30], ["3", 11], ["4", 3]],
  townhouse: [["2", 20], ["3", 50], ["4", 30]],
  villa: [["3", 25], ["4", 45], ["5+", 30]],
};

// Small, deterministic random number generator (mulberry32).
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(items: [T, number][], rand: () => number): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1]![0];
}

function monthsBetween(start: string, end: string): string[] {
  const [sy, sm] = start.split("-").map(Number) as [number, number];
  const [ey, em] = end.split("-").map(Number) as [number, number];
  const out: string[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, (m = 1)) : m++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function generateSales(seed = 20261031): SaleRecord[] {
  const rand = rng(seed);
  const months = monthsBetween(DATA_START, DATA_END);
  const rows: SaleRecord[] = [];
  let id = 1;

  months.forEach((month, monthIndex) => {
    // Prices drift up about 0.5% a month, with a slower patch in mid-2025.
    const trend = Math.pow(1.005, monthIndex) * (monthIndex > 17 && monthIndex < 22 ? 0.985 : 1);
    // Seasonal volume: quieter in summer.
    const monthNum = Number(month.slice(5));
    const season = monthNum >= 6 && monthNum <= 8 ? 0.75 : 1;

    for (const area of SAMPLE_AREAS) {
      const types = Object.keys(area.pricePerSqft) as PropertyType[];
      const sales = Math.round(area.volume * 9 * season * (0.85 + rand() * 0.3));
      for (let i = 0; i < sales; i++) {
        const type = types.length === 1 ? types[0]! : pickWeighted(types.map((t) => [t, t === "apartment" ? 3 : 1] as [PropertyType, number]), rand);
        const rooms = pickWeighted(ROOM_WEIGHTS[type], rand);
        const sizeRange = SIZES[type][rooms] ?? [1000, 1500];
        const size = Math.round(sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0]));
        const registration: Registration = rand() < area.offPlanShare ? "off-plan" : "ready";
        // Bigger units cost a little less per sq ft; off-plan is slightly cheaper.
        const sizeFactor = rooms === "studio" ? 1.08 : rooms === "1" ? 1.03 : rooms === "4" || rooms === "5+" ? 0.94 : 1;
        const regFactor = registration === "off-plan" ? 0.97 : 1;
        const noise = 0.86 + rand() * 0.28;
        const psf = area.pricePerSqft[type]! * trend * sizeFactor * regFactor * noise;
        const price = Math.round((psf * size) / 1000) * 1000;
        const day = 1 + Math.floor(rand() * daysInMonth(month));
        rows.push({
          transaction_id: `S-${String(id++).padStart(6, "0")}`,
          instance_date: `${month}-${String(day).padStart(2, "0")}`,
          area_name_en: area.name,
          project_name: `${area.name.split(" ")[0]} Sample ${type === "apartment" ? "Tower" : "Community"} ${1 + Math.floor(rand() * 6)}`,
          property_type: type,
          rooms,
          registration,
          size_sqft: size,
          price_aed: price,
          price_per_sqft: Math.round((price / size) * 100) / 100,
        });
      }
    }
  });

  return rows;
}
