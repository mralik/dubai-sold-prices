// HTTP API, built with Hono so it can move to Cloudflare Workers later.

import { Hono } from "hono";
import { AREAS } from "./areas";
import { ask, plannerMode } from "./ask";
import { getSnapshot } from "./snapshot";
import { CLAUDE_MODEL } from "./claudePlanner";
import { query } from "./database";
import { DATA_INFO } from "./dataMode";

const SAMPLE_EXAMPLE_QUESTIONS = [
  "What did 2-bed apartments in JVC sell for in the last 6 months?",
  "Price per sq ft in Dubai Marina month by month this year",
  "Compare Downtown and Business Bay 1-bed prices in 2025",
  "How many off-plan sales in Dubai Creek Harbour last year?",
  "Villa prices in Dubai Hills over time since 2024",
  "Will prices in JLT go up next year?",
];

function friendlyAreaName(officialName: string): string {
  if (officialName === "Business Bay") return officialName;
  const alias = AREAS.find((area) => area.name === officialName)?.aliases[0];
  if (!alias) return officialName;
  if (/^[a-z]{2,4}$/.test(alias)) return alias.toUpperCase();
  return alias.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dldExamples(topAreas: string[]): string[] {
  const labels = topAreas.map(friendlyAreaName);
  const [first = "Dubai", second = first] = labels;
  const third = labels.slice(2).find((label) => !/^(?:Al |Wadi |Madinat |Jabal |Me')/.test(label)) ?? second;
  return [
    `What did 1-bed apartments in ${first} sell for?`,
    "JVC 1-bed price per sq ft month by month",
    `Compare ${first} and ${second} 1-bed apartment prices`,
    `How many off-plan sales were recorded in ${third}?`,
  ];
}

const app = new Hono();

// Simple per-visitor limit: 30 questions a minute.
const hits = new Map<string, { windowStart: number; count: number }>();
function allowRequest(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart > 60_000) {
    hits.set(key, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= 30;
}

app.get("/api/meta", async (c) => {
  const [[row], topAreaRows] = await Promise.all([
    query<{ total: number }>("SELECT COUNT(*) AS total FROM sales"),
    DATA_INFO.mode === "dld"
      ? query<{ area: string; total: number }>("SELECT area_name_en AS area, COUNT(*) AS total FROM sales GROUP BY area_name_en ORDER BY total DESC LIMIT 20")
      : Promise.resolve([]),
  ]);
  return c.json({
    areas: AREAS.map((a) => a.name),
    dataFrom: DATA_INFO.from,
    dataTo: DATA_INFO.to,
    latestTransactionDate: DATA_INFO.latestTransactionDate,
    dataSourceLabel: DATA_INFO.sourceLabel,
    dataAttribution: DATA_INFO.attribution,
    totalSales: row?.total ?? 0,
    planner: plannerMode(),
    model: plannerMode() === "claude" ? CLAUDE_MODEL : null,
    examples: DATA_INFO.mode === "dld" ? dldExamples(topAreaRows.map((area) => area.area)) : SAMPLE_EXAMPLE_QUESTIONS,
    sampleData: DATA_INFO.sampleData,
  });
});

app.get("/api/snapshot", async (c) => {
  try {
    return c.json(await getSnapshot());
  } catch (err) {
    console.error("snapshot failed:", err);
    return c.json({ error: "The monthly snapshot could not be prepared." }, 500);
  }
});

app.post("/api/ask", async (c) => {
  const visitor = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "local";
  if (!allowRequest(visitor)) return c.json({ error: "Too many questions. Please wait a minute and try again." }, 429);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Send JSON like {\"question\": \"...\"}." }, 400);
  }
  const question = typeof body === "object" && body !== null && "question" in body ? String((body as { question: unknown }).question ?? "").trim() : "";
  if (question.length < 3) return c.json({ error: "Type a question first." }, 400);
  if (question.length > 300) return c.json({ error: "Please keep questions under 300 characters." }, 400);

  try {
    return c.json(await ask(question));
  } catch (err) {
    console.error("ask failed:", err);
    return c.json({ error: "Something went wrong answering that. Please try again." }, 500);
  }
});

export default app;
