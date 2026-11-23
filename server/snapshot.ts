// "Dubai this month": one cached read of the loaded sales.
// Price changes compare the same kind of home in both periods.
// Every median uses the same function as an answer. Nothing here is a forecast.

import { summarize } from "./aggregate";
import { AREAS } from "./areas";
import { COMMUNITIES, communityProjects, communityValues } from "./communities";
import { query } from "./db";
import { DATA_INFO } from "./dataMode";
import { displayName } from "./displayName";
import { addMonths, monthLongLabel } from "./plan";
import { projectSubtitle, dominantProject } from "./projectLabel";
import type { SaleRecord } from "./sampleData";

export const MIN_CHANGE_SALES = 30;
export const MIN_SEGMENT_SALES = 10;
export const MIN_COVERAGE = 0.6;
export const MIN_COMMUNITY_SHARE = 0.7;
export const LAUNCH_GROWTH = 3;

export interface SnapshotPlace {
  name: string;
  subtitle: string | null;
  officialName: string;
  kind: "area" | "community";
  sales: number;
  medianPrice: number | null;
  sparkline: number[];
  question: string;
}

export interface SnapshotChange {
  name: string;
  subtitle: string | null;
  officialName: string;
  kind: "area" | "community";
  changePct: number;
  /** Median price per sq ft of the biggest stable segment. */
  recentMedianPsf: number;
  priorMedianPsf: number;
  recentSales: number;
  priorSales: number;
  segmentsUsed: number;
  /** Lower of the two periods' kept-segment shares, in percent. */
  coveragePct: number;
  propertyType: string;
  rooms: string;
  registration: string;
  question: string;
}

export interface SnapshotLaunch {
  name: string;
  detail: string;
  sales: number;
  question: string;
  propertyType: string;
  rooms: string;
  registration: string;
}

export interface SnapshotWindow {
  from: string;
  to: string;
}

export interface Snapshot {
  sampleData: boolean;
  month: string;
  monthLabel: string;
  sparklineMonths: string[];
  periods: { latest: SnapshotWindow; recent: SnapshotWindow; prior: SnapshotWindow };
  busiest: SnapshotPlace[];
  rising: SnapshotChange[];
  falling: SnapshotChange[];
  launches: SnapshotLaunch[];
  registration: {
    offPlan: number;
    ready: number;
    offPlanShare: number;
    readyShare: number;
    offPlanQuestion: string;
    readyQuestion: string;
  };
}

export interface MixSale {
  registration: string;
  propertyType: string;
  rooms: string;
  pricePerSqft: number;
}

export interface LikeForLike {
  changePct: number;
  segmentsUsed: number;
  coveragePct: number;
  recentMedianPsf: number;
  priorMedianPsf: number;
  recentSales: number;
  priorSales: number;
  registration: string;
  propertyType: string;
  rooms: string;
  segmentLabel: string;
}

export interface PlaceRow {
  kind: "area" | "community";
  officialName: string;
  name: string;
  sales: number;
}

interface Point {
  price: number;
  psf: number;
  registration: string;
  propertyType: string;
  rooms: string;
  monthIndex: number;
  master: string;
  project: string;
}

interface PlaceSpec {
  kind: "area" | "community";
  officialName: string;
  name: string;
  points: Point[];
}

interface PlaceLinks {
  share: Map<string, { community: string; share: number }>;
  communitiesInArea: Map<string, string[]>;
}

const masterToCommunity = new Map<string, string>();
const projectToCommunity = new Map<string, string>();
for (const community of COMMUNITIES) {
  for (const value of community.values) masterToCommunity.set(value.trim().toLowerCase(), community.name);
  for (const project of community.projects ?? []) projectToCommunity.set(project.trim().toLowerCase(), community.name);
}

function blankSale(index: number, priceAed: number, pricePerSqft: number): SaleRecord {
  return {
    transaction_id: String(index),
    instance_date: "2026-10-01",
    area_name_en: "",
    project_name: "",
    property_type: "apartment",
    rooms: "1",
    registration: "ready",
    size_sqft: 1,
    price_aed: priceAed,
    price_per_sqft: pricePerSqft,
  };
}

function psfSales(values: number[]): SaleRecord[] {
  return values.map((pricePerSqft, index) => blankSale(index, pricePerSqft, pricePerSqft));
}

function pointSales(points: Point[]): SaleRecord[] {
  return points.map((point, index) => blankSale(index, point.price, point.psf));
}

function medianPsf(values: number[]): number {
  return summarize(psfSales(values)).medianPricePerSqft ?? 0;
}

export interface SegmentStat {
  registration: string;
  propertyType: string;
  rooms: string;
  recentSales: number;
  priorSales: number;
  changePct: number;
  recentMedianPsf: number;
  priorMedianPsf: number;
}

export function segmentHomes(registration: string, propertyType: string, rooms: string, plural = true): string {
  const type = propertyType === "apartment" ? (plural ? "apartments" : "apartment")
    : propertyType === "villa" ? (plural ? "villas" : "villa")
    : propertyType === "townhouse" ? (plural ? "townhouses" : "townhouse")
    : plural ? `${propertyType}s` : propertyType;
  const status = registration === "off-plan" ? "off-plan" : registration === "ready" ? "ready" : "";
  if (rooms === "studio") return `${status} studio ${type}`.trim();
  if (!rooms || rooms === "any") return `${status} ${type}`.trim();
  return `${status} ${rooms}-bed ${type}`.trim();
}

export function segmentQuestion(place: string, homes: string, kind: "price" | "launch"): string {
  if (kind === "launch") return `How many ${homes} sales were recorded in ${place} in the last 3 months?`;
  return `Price per sq ft for ${homes} in ${place} in the last 6 months`;
}

interface SegmentBucket {
  registration: string;
  propertyType: string;
  rooms: string;
  recent: number[];
  prior: number[];
}

/** Splits sales into stable segments and segments whose sales grew 3x or more. */
export function classifySegments(recent: MixSale[], prior: MixSale[]): { price: SegmentStat[]; launches: SegmentStat[] } {
  const groups = new Map<string, SegmentBucket>();
  const add = (sale: MixSale, period: "recent" | "prior") => {
    const key = `${sale.registration}\0${sale.propertyType}\0${sale.rooms}`;
    let group = groups.get(key);
    if (!group) groups.set(key, group = { registration: sale.registration, propertyType: sale.propertyType, rooms: sale.rooms, recent: [], prior: [] });
    group[period].push(sale.pricePerSqft);
  };
  recent.forEach((sale) => add(sale, "recent"));
  prior.forEach((sale) => add(sale, "prior"));

  const price: SegmentStat[] = [];
  const launches: SegmentStat[] = [];
  for (const group of groups.values()) {
    const recentMedian = group.recent.length ? medianPsf(group.recent) : 0;
    const priorMedian = group.prior.length ? medianPsf(group.prior) : 0;
    const changePct = priorMedian > 0 ? Math.round(((recentMedian - priorMedian) / priorMedian) * 1000) / 10 : 0;
    const stat: SegmentStat = {
      registration: group.registration,
      propertyType: group.propertyType,
      rooms: group.rooms,
      recentSales: group.recent.length,
      priorSales: group.prior.length,
      changePct,
      recentMedianPsf: recentMedian,
      priorMedianPsf: priorMedian,
    };
    const grew = group.prior.length > 0 && group.recent.length >= MIN_SEGMENT_SALES && group.recent.length >= LAUNCH_GROWTH * group.prior.length;
    if (grew) {
      launches.push(stat);
      continue;
    }
    if (group.recent.length < MIN_SEGMENT_SALES || group.prior.length < MIN_SEGMENT_SALES || priorMedian <= 0) continue;
    price.push(stat);
  }
  return { price, launches };
}

/**
 * The price change for one place, holding registration, property type and
 * bedroom count fixed. A segment whose sales grew 3x or more is left out.
 * The headline is the biggest remaining segment. The place needs 30 sales
 * in each period, and the kept segments must cover at least 60% of sales
 * in each period.
 */
export function likeForLikeChange(recent: MixSale[], prior: MixSale[]): LikeForLike | null {
  const recentKnown = recent.filter((sale) => sale.rooms !== "unknown");
  const priorKnown = prior.filter((sale) => sale.rooms !== "unknown");
  if (recentKnown.length < MIN_CHANGE_SALES || priorKnown.length < MIN_CHANGE_SALES) return null;
  const { price } = classifySegments(recentKnown, priorKnown);
  if (price.length === 0) return null;
  const keptRecent = price.reduce((sum, segment) => sum + segment.recentSales, 0);
  const keptPrior = price.reduce((sum, segment) => sum + segment.priorSales, 0);
  const recentCoverage = keptRecent / recentKnown.length;
  const priorCoverage = keptPrior / priorKnown.length;
  if (recentCoverage < MIN_COVERAGE || priorCoverage < MIN_COVERAGE) return null;
  const biggest = [...price].sort((a, b) =>
    (b.recentSales + b.priorSales) - (a.recentSales + a.priorSales)
    || b.recentSales - a.recentSales
    || segmentHomes(a.registration, a.propertyType, a.rooms).localeCompare(segmentHomes(b.registration, b.propertyType, b.rooms)))[0]!;
  return {
    changePct: biggest.changePct,
    segmentsUsed: price.length,
    coveragePct: Math.round(Math.min(recentCoverage, priorCoverage) * 1000) / 10,
    recentMedianPsf: biggest.recentMedianPsf,
    priorMedianPsf: biggest.priorMedianPsf,
    recentSales: recentKnown.length,
    priorSales: priorKnown.length,
    registration: biggest.registration,
    propertyType: biggest.propertyType,
    rooms: biggest.rooms,
    segmentLabel: segmentHomes(biggest.registration, biggest.propertyType, biggest.rooms),
  };
}

/**
 * One row per set of sales. A community that is more than 70% of an area
 * takes that area's place. An area and a community inside it are never both kept.
 */
export function choosePlaceRows<T extends PlaceRow>(
  rows: T[],
  communityShare: Map<string, { community: string; share: number }>,
  communitiesInArea: Map<string, string[]>,
  limit: number,
): T[] {
  const byCommunity = new Map(rows.filter((row) => row.kind === "community").map((row) => [row.officialName, row]));
  const eligibleAreas = new Set(rows.filter((row) => row.kind === "area").map((row) => row.officialName));
  const sorted = [...rows].sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));
  const picked: T[] = [];
  const pickedAreas = new Set<string>();
  const pickedCommunities = new Set<string>();
  const parentsOf = (community: string) =>
    [...communitiesInArea.entries()].filter(([, names]) => names.includes(community)).map(([area]) => area);
  const overlapsCommunity = (community: string) => parentsOf(community).some((area) => pickedAreas.has(area));
  const overlapsArea = (area: string) => (communitiesInArea.get(area) ?? []).some((community) => pickedCommunities.has(community));

  for (const row of sorted) {
    if (row.kind === "area") {
      if (pickedAreas.has(row.officialName) || overlapsArea(row.officialName)) continue;
      const dominant = communityShare.get(row.officialName);
      if (dominant && dominant.share > MIN_COMMUNITY_SHARE) {
        const community = byCommunity.get(dominant.community);
        if (community) {
          if (!pickedCommunities.has(community.officialName) && !overlapsCommunity(community.officialName)) {
            picked.push(community);
            pickedCommunities.add(community.officialName);
            pickedAreas.add(row.officialName);
          }
          continue;
        }
      }
      picked.push(row);
      pickedAreas.add(row.officialName);
      continue;
    }
    if (pickedCommunities.has(row.officialName) || overlapsCommunity(row.officialName)) continue;
    const parents = parentsOf(row.officialName);
    const dominates = parents.some((area) => communityShare.get(area)?.community === row.officialName && (communityShare.get(area)?.share ?? 0) > MIN_COMMUNITY_SHARE);
    if (!dominates && parents.some((area) => eligibleAreas.has(area))) continue;
    picked.push(row);
    pickedCommunities.add(row.officialName);
  }
  return picked.sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name)).slice(0, limit);
}

export function rankPriceChanges(candidates: SnapshotChange[]): { rising: SnapshotChange[]; falling: SnapshotChange[] } {
  const qualified = candidates.filter((candidate) =>
    candidate.recentSales >= MIN_CHANGE_SALES
    && candidate.priorSales >= MIN_CHANGE_SALES
    && candidate.coveragePct >= MIN_COVERAGE * 100
    && candidate.segmentsUsed > 0
    && candidate.priorMedianPsf > 0
    && candidate.changePct !== 0);
  return {
    rising: qualified.filter((candidate) => candidate.changePct > 0).sort((a, b) => b.changePct - a.changePct || b.recentSales - a.recentSales).slice(0, 5),
    falling: qualified.filter((candidate) => candidate.changePct < 0).sort((a, b) => a.changePct - b.changePct || b.recentSales - a.recentSales).slice(0, 5),
  };
}

function share(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function questionName(kind: PlaceSpec["kind"], officialName: string, label: string): string {
  if (kind === "community") return label;
  const key = label.toLowerCase();
  const taken = COMMUNITIES.some((community) => community.name.toLowerCase() === key || community.aliases.includes(key));
  return taken ? officialName : label;
}

function toMix(points: Point[]): MixSale[] {
  return points.map((point) => ({
    registration: point.registration,
    propertyType: point.propertyType,
    rooms: point.rooms,
    pricePerSqft: point.psf,
  }));
}

function linksFor(pointsByArea: Map<string, Point[]>, period: (point: Point) => boolean): PlaceLinks {
  const communityShare = new Map<string, { community: string; share: number }>();
  const communitiesInArea = new Map<string, string[]>();
  for (const [area, points] of pointsByArea) {
    let total = 0;
    const counts = new Map<string, number>();
    for (const point of points) {
      if (!period(point)) continue;
      total += 1;
      const community = masterToCommunity.get(point.master.trim().toLowerCase())
        ?? projectToCommunity.get(point.project.trim().toLowerCase());
      if (!community) continue;
      counts.set(community, (counts.get(community) ?? 0) + 1);
    }
    const names = [...counts.keys()];
    if (names.length > 0) communitiesInArea.set(area, names);
    let best: { community: string; count: number } | null = null;
    for (const [community, count] of counts) {
      if (!best || count > best.count) best = { community, count };
    }
    if (best && total > 0) communityShare.set(area, { community: best.community, share: best.count / total });
  }
  return { share: communityShare, communitiesInArea };
}

function placeSubtitle(officialName: string, points: Point[], period: (point: Point) => boolean): string | null {
  const aliases = AREAS.find((area) => area.name === officialName)?.aliases ?? [];
  if (aliases.length > 0) return null;
  const display = displayName(officialName, aliases).toLowerCase();
  const subtitle = projectSubtitle(points.filter(period).map((point) => ({ master: point.master, project: point.project })));
  if (!subtitle) return null;
  const labels = subtitle.replace(/^mostly /, "").split(", ").filter((label) => label.toLowerCase() !== display && label.toLowerCase() !== officialName.toLowerCase());
  return labels.length > 0 ? `mostly ${labels.join(", ")}` : null;
}

function monthCounts(points: Point[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const point of points) counts[point.monthIndex] = (counts[point.monthIndex] ?? 0) + 1;
  return counts;
}

export async function buildSnapshot(): Promise<Snapshot> {
  const month = DATA_INFO.to;
  const sparklineMonths = Array.from({ length: 6 }, (_, index) => addMonths(month, index - 5));
  const periods = {
    latest: { from: month, to: month },
    recent: { from: sparklineMonths[3]!, to: month },
    prior: { from: sparklineMonths[0]!, to: sparklineMonths[2]! },
  };
  const monthLabel = monthLongLabel(month);
  const rows = await query<{
    month: string;
    area_name_en: string;
    master_project: string;
    project_name: string;
    price_aed: number;
    price_per_sqft: number;
    registration: string;
    property_type: string;
    rooms: string;
  }>(
    `SELECT substr(instance_date, 1, 7) AS month, area_name_en, master_project, project_name, price_aed, price_per_sqft, registration, property_type, rooms
     FROM sales
     WHERE instance_date >= ? AND instance_date < ?`,
    [`${sparklineMonths[0]}-01`, `${addMonths(month, 1)}-01`],
  );

  const monthIndex = new Map(sparklineMonths.map((value, index) => [value, index]));
  const byArea = new Map<string, Point[]>();
  const byMaster = new Map<string, Point[]>();
  const byProject = new Map<string, Point[]>();
  let offPlan = 0;
  let ready = 0;
  for (const row of rows) {
    const index = monthIndex.get(String(row.month));
    if (index === undefined) continue;
    const point: Point = {
      price: Number(row.price_aed),
      psf: Number(row.price_per_sqft),
      registration: String(row.registration),
      propertyType: String(row.property_type),
      rooms: String(row.rooms),
      monthIndex: index,
      master: String(row.master_project),
      project: String(row.project_name),
    };
    const areaKey = String(row.area_name_en);
    const areaPoints = byArea.get(areaKey);
    if (areaPoints) areaPoints.push(point);
    else byArea.set(areaKey, [point]);
    const masterKey = point.master;
    const masterPoints = byMaster.get(masterKey);
    if (masterPoints) masterPoints.push(point);
    else byMaster.set(masterKey, [point]);
    const projectPoints = byProject.get(point.project);
    if (projectPoints) projectPoints.push(point);
    else byProject.set(point.project, [point]);
    if (index === 5) {
      if (point.registration === "off-plan") offPlan += 1;
      else if (point.registration === "ready") ready += 1;
    }
  }

  const places: PlaceSpec[] = [];
  for (const [officialName, points] of byArea) {
    const aliases = AREAS.find((area) => area.name === officialName)?.aliases ?? [];
    places.push({ kind: "area", officialName, name: displayName(officialName, aliases), points });
  }
  for (const community of COMMUNITIES) {
    const seen = new Set<Point>();
    const points: Point[] = [];
    const add = (point: Point) => {
      if (seen.has(point)) return;
      seen.add(point);
      points.push(point);
    };
    for (const value of communityValues([community.name])) for (const point of byMaster.get(value) ?? []) add(point);
    for (const value of communityProjects([community.name])) for (const point of byProject.get(value) ?? []) add(point);
    if (points.length === 0) continue;
    places.push({ kind: "community", officialName: community.name, name: community.name, points });
  }

  const isLatest = (point: Point) => point.monthIndex === 5;
  const isRecent = (point: Point) => point.monthIndex >= 3;
  const isPrior = (point: Point) => point.monthIndex <= 2;
  const isEither = () => true;
  const latestLinks = linksFor(byArea, isLatest);
  const changeLinks = linksFor(byArea, isEither);

  const busiestRows = places.flatMap((place) => {
    const latest = place.points.filter(isLatest);
    if (latest.length === 0) return [];
    const summary = summarize(pointSales(latest));
    const asked = questionName(place.kind, place.officialName, place.name);
    const row: SnapshotPlace = {
      name: place.name,
      subtitle: place.kind === "area" ? placeSubtitle(place.officialName, place.points, isLatest) : null,
      officialName: place.officialName,
      kind: place.kind,
      sales: latest.length,
      medianPrice: summary.medianPrice,
      sparkline: monthCounts(place.points),
      question: `What did homes in ${asked} sell for in ${monthLabel}?`,
    };
    return [row];
  });
  const busiest = choosePlaceRows(busiestRows, latestLinks.share, latestLinks.communitiesInArea, 5);

  const changeRows = places.flatMap((place) => {
    const recentPoints = place.points.filter(isRecent);
    const priorPoints = place.points.filter(isPrior);
    const like = likeForLikeChange(toMix(recentPoints), toMix(priorPoints));
    if (!like) return [];
    const asked = questionName(place.kind, place.officialName, place.name);
    const projects = place.kind === "area" ? placeSubtitle(place.officialName, place.points, isEither) : null;
    const row: SnapshotChange & { sales: number } = {
      name: place.name,
      subtitle: [projects, like.segmentLabel].filter(Boolean).join(" · ") || null,
      officialName: place.officialName,
      kind: place.kind,
      changePct: like.changePct,
      recentMedianPsf: like.recentMedianPsf,
      priorMedianPsf: like.priorMedianPsf,
      recentSales: like.recentSales,
      priorSales: like.priorSales,
      segmentsUsed: like.segmentsUsed,
      coveragePct: like.coveragePct,
      propertyType: like.propertyType,
      rooms: like.rooms,
      registration: like.registration,
      question: segmentQuestion(asked, like.segmentLabel, "price"),
      sales: like.recentSales + like.priorSales,
    };
    return [row];
  });
  const deduped = choosePlaceRows(changeRows, changeLinks.share, changeLinks.communitiesInArea, changeRows.length);
  const launches = collectLaunches(places.filter((place) => place.kind === "area"), isRecent, isPrior);

  const registrationTotal = offPlan + ready;
  return {
    sampleData: DATA_INFO.sampleData,
    month,
    monthLabel,
    sparklineMonths,
    periods,
    busiest,
    ...rankPriceChanges(deduped),
    launches,
    registration: {
      offPlan,
      ready,
      offPlanShare: share(offPlan, registrationTotal),
      readyShare: share(ready, registrationTotal),
      offPlanQuestion: `How many off-plan sales were recorded in ${monthLabel}?`,
      readyQuestion: `How many ready sales were recorded in ${monthLabel}?`,
    },
  };
}

function collectLaunches(areas: PlaceSpec[], isRecent: (point: Point) => boolean, isPrior: (point: Point) => boolean): SnapshotLaunch[] {
  const rows: SnapshotLaunch[] = [];
  for (const place of areas) {
    const { launches } = classifySegments(toMix(place.points.filter(isRecent)), toMix(place.points.filter(isPrior)));
    for (const launch of launches) {
      const recent = place.points.filter((point) => isRecent(point) && point.registration === launch.registration && point.propertyType === launch.propertyType && point.rooms === launch.rooms);
      const project = dominantProject(recent.map((point) => ({ master: point.master, project: point.project })));
      const known = project ? COMMUNITIES.some((community) => community.name === project) : false;
      const asked = known && project ? project : questionName(place.kind, place.officialName, place.name);
      const homes = segmentHomes(launch.registration, launch.propertyType, launch.rooms, false);
      rows.push({
        name: project || place.name,
        detail: `${launch.recentSales.toLocaleString("en-US")} ${homes} sales`,
        sales: launch.recentSales,
        question: segmentQuestion(asked, homes, "launch"),
        propertyType: launch.propertyType,
        rooms: launch.rooms,
        registration: launch.registration,
      });
    }
  }
  const seen = new Set<string>();
  return rows
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name))
    .filter((row) => {
      const key = `${row.name}|${row.registration}|${row.propertyType}|${row.rooms}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

let cached: Promise<Snapshot> | null = null;

/** The first call computes the snapshot. Later calls reuse it. */
export function getSnapshot(): Promise<Snapshot> {
  cached ??= buildSnapshot().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}
