import { AREAS } from "./areas";
import { COMMUNITIES } from "./communities";
import type { QueryPlan } from "./plan";
import { communityProjects, communityValues } from "./communities";
import type { SaleRecord } from "./sampleData";
import { displayName } from "./displayName";

export interface ResolvedPlace {
  kind: "area" | "community";
  name: string;
  label: string;
  index: number;
  values: string[];
  projects?: string[];
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findText = (question: string, value: string) => {
  const match = new RegExp(`(^|[^a-z0-9])(${escapePattern(value)})(?=[^a-z0-9]|$)`, "i").exec(question);
  return match ? { text: match[2]!, index: match.index + match[1]!.length } : null;
};

function canonicalAlias(alias: string): string {
  if (/^[a-z0-9]{2,4}$/.test(alias)) return alias.toUpperCase();
  return alias.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function areaLabel(question: string, officialName: string): { label: string; index: number } {
  const official = findText(question, officialName);
  if (official) return { label: officialName, index: official.index };
  const area = AREAS.find((candidate) => candidate.name === officialName);
  for (const alias of area?.aliases ?? []) {
    const matched = findText(question, alias);
    if (matched) {
      const friendly = officialName === "Marsa Dubai" ? displayName(officialName, area?.aliases ?? []) : canonicalAlias(alias);
      return { label: `${friendly} (${officialName})`, index: matched.index };
    }
  }
  return { label: officialName, index: Number.MAX_SAFE_INTEGER };
}

function communityLabel(question: string, name: string): { label: string; index: number } {
  const community = COMMUNITIES.find((candidate) => candidate.name === name);
  const candidates = [name, ...(community?.aliases ?? [])];
  for (const candidate of candidates) {
    const matched = findText(question, candidate);
    if (matched) return { label: name, index: matched.index };
  }
  return { label: name, index: Number.MAX_SAFE_INTEGER };
}

export function resolvedPlacesForQuestion(question: string, plan: QueryPlan): ResolvedPlace[] {
  return [
    ...plan.communities.map((community) => ({ kind: "community" as const, name: community, ...communityLabel(question, community), values: communityValues([community]), projects: communityProjects([community]) })),
    ...plan.areas.map((area) => ({ kind: "area" as const, name: area, ...areaLabel(question, area), values: [area] })),
  ].sort((a, b) => a.index - b.index);
}

export function placeLabelsForQuestion(question: string, plan: QueryPlan): string[] {
  return resolvedPlacesForQuestion(question, plan).map((place) => place.label);
}

export function saleMatchesPlace(sale: SaleRecord, place: ResolvedPlace): boolean {
  if (place.kind === "area") return place.values.includes(sale.area_name_en);
  return place.values.includes(sale.master_project ?? "") || (place.projects ?? []).includes(sale.project_name);
}

