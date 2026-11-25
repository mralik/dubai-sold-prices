// Loads the SQL files from data/d1/ into the D1 database with wrangler.
//   tsx data/d1Load.ts --local                 every file, into the local D1 used by `wrangler dev`
//   tsx data/d1Load.ts --remote 0-schema.sql   chosen files, into the live database
// On the free plan, load at most one row file a day (see data/d1Export.ts).

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;
if (!target) throw new Error("Pass --local or --remote.");
const chosen = args.filter((arg) => !arg.startsWith("--"));
const dir = new URL("./d1/", import.meta.url);
const files = (chosen.length ? chosen : readdirSync(dir).filter((file) => file.endsWith(".sql")).sort());

for (const file of files) {
  console.log(`Loading ${file} (${target.slice(2)})...`);
  execFileSync("npx", ["wrangler", "d1", "execute", "dubai-sold-prices", target, "--yes", `--file=${new URL(file, dir).pathname}`], { stdio: "inherit" });
}
