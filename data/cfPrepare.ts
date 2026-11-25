// Builds the files the Cloudflare Worker ships with, from the local DLD data:
//   worker/generated/metadata.json  coverage, areas and attribution (no file system on Workers)
//   worker/generated/meta.json      the /api/meta response
//   worker/generated/snapshot.json  the /api/snapshot response
//   worker/generated/communityAreas.json  the areas each community's sales fall in
// Pre-building /api/meta and /api/snapshot means they cost no database reads per visit.
//
//   DATA_MODE=dld tsx data/cfPrepare.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import "../server/db";

if (process.env.DATA_MODE !== "dld") throw new Error("Run with DATA_MODE=dld.");
// The public demo always uses the free built-in reader.
delete process.env.ANTHROPIC_API_KEY;

const { default: app } = await import("../server/app");
const outDir = new URL("../worker/generated/", import.meta.url);
mkdirSync(outDir, { recursive: true });

async function save(name: string, path: string) {
  const response = await app.request(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const body = await response.json();
  writeFileSync(new URL(name, outDir), `${JSON.stringify(body)}\n`);
  return body;
}

const { COMMUNITIES, communityProjects, communityValues } = await import("../server/communities");
const { query } = await import("../server/database");
const communityAreas: Record<string, string[]> = {};
for (const community of COMMUNITIES) {
  const masters = communityValues([community.name]);
  const projects = communityProjects([community.name]);
  const conditions = [
    ...(masters.length ? [`master_project IN (${masters.map(() => "?").join(", ")})`] : []),
    ...(projects.length ? [`project_name IN (${projects.map(() => "?").join(", ")})`] : []),
  ];
  const areas = conditions.length
    ? await query<{ area: string }>(`SELECT DISTINCT area_name_en AS area FROM sales WHERE ${conditions.join(" OR ")} ORDER BY area`, [...masters, ...projects])
    : [];
  communityAreas[community.name] = areas.map((row) => row.area);
}
// A new id on every build, so cached answers from an older version are never served.
writeFileSync(new URL("build.json", outDir), `${JSON.stringify({ id: new Date().toISOString() })}\n`);
writeFileSync(new URL("communityAreas.json", outDir), `${JSON.stringify(communityAreas, null, 2)}\n`);

const metadata = readFileSync(new URL("../data/processed/sales.parquet.meta.json", import.meta.url), "utf8");
writeFileSync(new URL("metadata.json", outDir), metadata);
const meta = await save("meta.json", "/api/meta") as { totalSales: number; dataFrom: string; dataTo: string; planner: string };
await save("snapshot.json", "/api/snapshot");
console.log(`Prepared worker/generated for ${meta.totalSales.toLocaleString("en-US")} sales, ${meta.dataFrom} to ${meta.dataTo} (reader: ${meta.planner}).`);
