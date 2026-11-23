// A free, rule-based question reader used when no Claude API key is set.
// It understands the common question shapes well enough for a demo and tests.
// The Claude reader (claudePlanner.ts) handles wording this can't.

import { AREAS, AREA_PATTERNS } from "./areas";
import { COMMUNITIES, COMMUNITY_PATTERNS } from "./communities";
import { addMonths, defaultDateRange, type QueryPlan } from "./plan";
import { DATA_INFO } from "./dataMode";
import { displayName } from "./displayName";

const DATA_END = DATA_INFO.to;

const NUMBER_WORDS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5" };

const UNSUPPORTED: [RegExp, string][] = [
  [/\b(rent|rents|rental|rentals|lease|leasing|ejari)\b/, "This data only covers sales, not rents."],
  [/\b(predict|prediction|forecast|will .*\b(rise|fall|go up|go down|increase|drop)|next year|in the future)\b/, "I can only report past sales, not predict future prices."],
  [/\b(mortgage|mortgages|loan|gift)\b/, "This data only covers sales transactions."],
  [/\b(buy|invest|good investment|should i)\b/, "I can show past sale prices, but I can't give investment advice."],
];

function findPlaces(q: string, patterns: { pattern: string; name: string }[]): { names: string[]; matches: { name: string; index: number }[]; masked: string } {
  const found = new Map<string, number>(); // area -> position in the question
  let text = ` ${q} `;
  // Longest names first, so "dubai creek harbour" wins over "creek harbour".
  for (const { pattern, name } of patterns) {
    const re = new RegExp(`(^|[^a-z0-9])(${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=[^a-z0-9]|$)`);
    const match = re.exec(text);
    if (!match) continue;
    const start = match.index + match[1]!.length;
    if (!found.has(name)) found.set(name, start);
    // Blank out the match (same length) so shorter nicknames can't match it again.
    text = text.slice(0, start) + " ".repeat(match[2]!.length) + text.slice(start + match[2]!.length);
  }
  const matches = [...found.entries()].sort((a, b) => a[1] - b[1]).map(([name, index]) => ({ name, index }));
  return { names: matches.map(({ name }) => name), matches, masked: text };
}

const COMPARISON = /\b(compare|vs\.?|versus)\b/;

function friendlyPlace(name: string): string {
  const area = AREAS.find((candidate) => candidate.name === name);
  return area ? displayName(area.name, area.aliases) : name;
}

/** Reject comparison shapes the current query plan cannot represent without dropping intent. */
export function comparisonUnsupportedReason(question: string): string | null {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const communityMatch = findPlaces(q, COMMUNITY_PATTERNS);
  const areaMatch = findPlaces(communityMatch.masked, AREA_PATTERNS);
  const places = [...areaMatch.matches, ...communityMatch.matches].sort((a, b) => a.index - b.index).map(({ name }) => name);
  if (places.length > 2) {
    const suggestion = [places[0]!, places.at(-1)!].map(friendlyPlace);
    return `I can compare up to 2 places at a time. Try 'Compare ${suggestion.join(" and ")}'.`;
  }
  if (COMPARISON.test(q)) {
    const types = [
      /\b(villas?)\b/.test(q),
      /\b(town\s?houses?)\b/.test(q),
      /\b(apartments?|flats?|units?|condos?)\b/.test(q),
    ].filter(Boolean).length;
    if (types > 1) return "I can compare places, not property types yet. Ask about villas and townhouses separately.";
  }
  return null;
}

function unknownPlace(question: string): string | null {
  const match = /\b(?:in|at|for)\s+([a-z][a-z0-9' -]*)/i.exec(question);
  if (!match) return null;
  const candidate = match[1]!
    .split(/\b(?:sell|sold|sale|prices?|during|last|past|this|since|over|month|year|off-plan|ready|with)\b/i)[0]!
    .trim().replace(/[?.!,]+$/, "");
  const globalOrTime = /^(?:dubai|all of dubai|all areas|anywhere|lately|recently|recent|now|today|this year|last year|(?:the )?(?:last|past|previous)\s+\d+\s+months?|(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+20\d{2})?)$/i;
  if (!candidate || globalOrTime.test(candidate) || /^(?:apartments?|flats?|units?|villas?|townhouses?|properties|homes|sales?|studios?)$/i.test(candidate)) return null;
  return candidate;
}

function placeSuggestions(): string[] {
  const preferred = ["JVC", "Dubai Marina", "Business Bay", "JLT", "Al Furjan"];
  const available = new Set([
    ...AREAS.flatMap((area) => [area.name.toLowerCase(), ...area.aliases]),
    ...COMMUNITIES.flatMap((community) => [community.name.toLowerCase(), ...community.aliases]),
  ]);
  return preferred.filter((name) => available.has(name.toLowerCase())).slice(0, 5);
}

function findRooms(q: string): QueryPlan["rooms"] {
  if (/\bstudios?\b/.test(q)) return "studio";
  const word = q.match(/\b(one|two|three|four|five)[\s-]*(bed|bedroom|br|b\/r|bhk)/);
  if (word) return toRooms(NUMBER_WORDS[word[1]!]!);
  const digit = q.match(/\b(\d)\s*[- ]?\s*(\+)?\s*(bed|beds|bedroom|bedrooms|br|b\/r|bhk|bd)\b/);
  if (digit) return toRooms(digit[1]!);
  return "any";
}

const toRooms = (n: string): QueryPlan["rooms"] => (Number(n) >= 5 ? "5+" : (n as QueryPlan["rooms"]));

function findType(q: string): QueryPlan["propertyType"] {
  if (/\bvillas?\b/.test(q)) return "villa";
  if (/\btown\s?houses?\b/.test(q)) return "townhouse";
  if (/\b(apartments?|flats?|units?|condos?)\b/.test(q)) return "apartment";
  return "any";
}

function findRegistration(q: string): QueryPlan["registration"] {
  if (/\boff[\s-]?plan\b/.test(q)) return "off-plan";
  if (/\b(ready|secondary|resale)\b/.test(q)) return "ready";
  return "any";
}

function findDates(q: string): { dateFrom: string; dateTo: string } {
  const lastN = q.match(/\b(?:last|past|previous)\s+(\d{1,2})\s+months?\b/);
  if (lastN) return { dateFrom: addMonths(DATA_END, -(Number(lastN[1]) - 1)), dateTo: DATA_END };
  if (/\b(?:last|past|previous)\s+(month)\b/.test(q)) return { dateFrom: DATA_END, dateTo: DATA_END };
  if (/\b(?:last|past|previous)\s+(?:quarter|3 months)\b/.test(q)) return { dateFrom: addMonths(DATA_END, -2), dateTo: DATA_END };
  if (/\b(?:last|past|previous)\s+(?:6 months|half year)\b/.test(q)) return { dateFrom: addMonths(DATA_END, -5), dateTo: DATA_END };
  const endYear = Number(DATA_END.slice(0, 4));
  if (/\bthis year\b|\bytd\b|\byear to date\b/.test(q)) return { dateFrom: `${endYear}-01`, dateTo: DATA_END };
  if (/\blast year\b/.test(q)) return { dateFrom: `${endYear - 1}-01`, dateTo: `${endYear - 1}-12` };
  const since = q.match(/\bsince\s+(20\d{2})\b/);
  if (since) return { dateFrom: `${since[1]}-01`, dateTo: DATA_END };
  const range = q.match(/\b(20\d{2})\s*(?:-|to|until|and)\s*(20\d{2})\b/);
  if (range) return { dateFrom: `${range[1]}-01`, dateTo: `${range[2]}-12` };
  const namedMonth = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/);
  if (namedMonth) {
    const index = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(namedMonth[1]!);
    const ym = `${namedMonth[2]}-${String(index + 1).padStart(2, "0")}`;
    return { dateFrom: ym, dateTo: ym };
  }
  const year = q.match(/\b(20\d{2})\b/);
  if (year) return { dateFrom: `${year[1]}-01`, dateTo: `${year[1]}-12` };
  if (/\b(lately|recently|recent)\b/.test(q)) return { dateFrom: addMonths(DATA_END, -5), dateTo: DATA_END };
  return defaultDateRange();
}

function findMetric(q: string): QueryPlan["metric"] {
  if (/\b(per\s*(sq\.?\s*ft|square\s*f(oo|ee)t|sqft)|psf|price per foot|per sq)\b/.test(q)) return "median_price_per_sqft";
  if (/\b(how many|number of|count|volume|transactions? count)\b/.test(q)) return "count";
  return "median_price";
}

function findGroupBy(q: string, areas: string[]): QueryPlan["groupBy"] {
  // Keep the requested trend plan even for one-month datasets; validatePlan
  // adds the coverage warning so the user's intent remains visible.
  if (/\b(trend|month by month|monthly|over time|each month|per month|change|changed)\b/.test(q)) return "month";
  if (areas.length === 2) return "area";
  return "none";
}

export function demoPlan(question: string): QueryPlan {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const base = {
    areas: [] as string[],
    communities: [] as string[],
    propertyType: "any" as const,
    rooms: "any" as const,
    registration: "any" as const,
    ...defaultDateRange(),
    metric: "median_price" as const,
    groupBy: "none" as const,
  };

  for (const [re, reason] of UNSUPPORTED) {
    if (re.test(q)) return { status: "unsupported", unsupportedReason: reason, ...base };
  }

  const comparisonReason = comparisonUnsupportedReason(question);
  if (comparisonReason) return { status: "unsupported", unsupportedReason: comparisonReason, ...base };

  // Community matches are removed first, so a precise master-project filter
  // wins over a broader DLD area alias.
  const communityMatch = findPlaces(q, COMMUNITY_PATTERNS);
  const areaMatch = findPlaces(communityMatch.masked, AREA_PATTERNS);
  const communities = communityMatch.names;
  const areas = areaMatch.names;
  if (areas.length === 0 && communities.length === 0) {
    const unknown = unknownPlace(question);
    if (unknown) {
      const suggestions = placeSuggestions();
      return {
        status: "unsupported",
        unsupportedReason: `I don't recognise '${unknown}' yet.${suggestions.length ? ` Try one of: ${suggestions.join(", ")}.` : ""}`,
        ...base,
      };
    }
  }
  return {
    status: "ok",
    unsupportedReason: "",
    areas,
    communities,
    propertyType: findType(q),
    rooms: findRooms(q),
    registration: findRegistration(q),
    ...findDates(q),
    metric: findMetric(q),
    groupBy: COMPARISON.test(q) && areas.length + communities.length === 2 ? "area" : findGroupBy(q, [...areas, ...communities]),
  };
}
