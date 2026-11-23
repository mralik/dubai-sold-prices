import aliasFile from "./communityAliases.json";
import { DATA_MODE } from "./dataMode";

interface AliasEntry {
  values: string[];
  aliases: string[];
  projects?: string[];
}

export interface CommunityDefinition {
  name: string;
  values: string[];
  /** Project names, used when the master project is blank. */
  projects?: string[];
  aliases: string[];
}

const definitions: CommunityDefinition[] = Object.entries(aliasFile as Record<string, AliasEntry>).map(([name, definition]) => ({ name, ...definition }));
export const COMMUNITIES: CommunityDefinition[] = DATA_MODE === "dld" ? definitions : [];

const byName = new Map(definitions.map((community) => [community.name.toLowerCase(), community.name]));

export function canonicalCommunity(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (byName.has(key)) return byName.get(key)!;
  return definitions.find((community) => community.aliases.includes(key))?.name ?? null;
}

export function communityValues(names: string[]): string[] {
  return [...new Set(names.flatMap((name) => definitions.find((community) => community.name === name)?.values ?? []))];
}

export function communityProjects(names: string[]): string[] {
  return [...new Set(names.flatMap((name) => definitions.find((community) => community.name === name)?.projects ?? []))];
}

export const COMMUNITY_PATTERNS = COMMUNITIES.flatMap((community) =>
  [community.name, ...community.aliases].map((pattern) => ({ pattern: pattern.toLowerCase(), name: community.name })),
).sort((a, b) => b.pattern.length - a.pattern.length);

