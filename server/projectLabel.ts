// A short name for the homes inside an unfamiliar area.
// master_project is used when it is a real place. A blank value, or a zone
// code such as DMCC-EZ2, falls back to the project name.

import { COMMUNITIES } from "./communities";

const masterToCommunity = new Map<string, string>();
const projectToCommunity = new Map<string, string>();
for (const community of COMMUNITIES) {
  for (const value of community.values) masterToCommunity.set(value.trim().toLowerCase(), community.name);
  for (const project of community.projects ?? []) projectToCommunity.set(project.trim().toLowerCase(), community.name);
}

export function isBlankPlaceName(value: string): boolean {
  const text = value.trim().toLowerCase();
  return text === "" || text === "-" || text === "n/a" || text.startsWith("unspecified");
}

function isZoneCode(value: string): boolean {
  return /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(value.trim());
}

export function salePlaceName(master: string, project: string): string | null {
  if (!isBlankPlaceName(master) && !isZoneCode(master)) {
    return masterToCommunity.get(master.trim().toLowerCase()) ?? master.trim();
  }
  if (!isBlankPlaceName(project)) return projectToCommunity.get(project.trim().toLowerCase()) ?? project.trim();
  return null;
}

/** Top one or two place names, for example "mostly LUNAYA". */
export function projectSubtitle(rows: { master: string; project: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = salePlaceName(row.master, row.project);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2);
  if (top.length === 0) return null;
  return `mostly ${top.map(([label]) => label).join(", ")}`;
}

/** The project, or the community it belongs to, that accounts for the most sales. */
export function dominantProject(rows: { master: string; project: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = !isBlankPlaceName(row.project)
      ? (projectToCommunity.get(row.project.trim().toLowerCase()) ?? row.project.trim())
      : salePlaceName(row.master, row.project);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top?.[0] ?? null;
}
