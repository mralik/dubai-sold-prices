// Local API server on http://localhost:8787. Vite forwards /api calls here.

import { readFileSync, existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import app from "./app";
import { getDb } from "./db";
import { plannerMode } from "./ask";

// Load .env without an extra dependency.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

await getDb(); // build the sample database before the first request
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`API ready on http://localhost:${port} (question reader: ${plannerMode() === "claude" ? "Claude" : "built-in"})`);
