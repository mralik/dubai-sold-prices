// Runs the question test set in evals/questions.json and scores the query plans.
//   npm run eval                          -> uses the built-in reader
//   ANTHROPIC_API_KEY=... npm run eval    -> uses Claude (billed; one call per question)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { claudePlan } from "../server/claudePlanner";
import { demoPlan } from "../server/demoPlanner";
import { validatePlan, type QueryPlan } from "../server/plan";

interface Case { q: string; expect?: Partial<QueryPlan>; unsupported?: boolean }

const cases: Case[] = JSON.parse(readFileSync(new URL("./questions.json", import.meta.url), "utf8"));
const useClaude = Boolean(process.env.ANTHROPIC_API_KEY);

const lines: string[] = [];
let passed = 0;
for (const c of cases) {
  let plan: QueryPlan;
  try {
    const raw = useClaude ? (await claudePlan(c.q)).plan : demoPlan(c.q);
    plan = validatePlan(raw).plan;
  } catch (e) {
    lines.push(`FAIL  ${c.q}\n      error: ${(e as Error).message}`);
    continue;
  }
  const problems: string[] = [];
  if (c.unsupported) {
    if (plan.status !== "unsupported") problems.push("expected a refusal");
  } else {
    if (plan.status !== "ok") problems.push(`refused: ${plan.unsupportedReason}`);
    for (const [key, want] of Object.entries(c.expect ?? {})) {
      const got = plan[key as keyof QueryPlan];
      if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }
  if (problems.length === 0) passed++;
  lines.push(`${problems.length ? "FAIL" : "PASS"}  ${c.q}${problems.length ? `\n      ${problems.join("\n      ")}` : ""}`);
}

const score = Math.round((passed / cases.length) * 100);
const report = [
  `# Evaluation report`,
  ``,
  `- Date: ${new Date().toISOString().slice(0, 10)}`,
  `- Reader: ${useClaude ? "Claude" : "built-in reader"}`,
  `- Score: **${passed}/${cases.length} (${score}%)**`,
  ``,
  "```",
  ...lines,
  "```",
].join("\n");

mkdirSync(new URL("./reports/", import.meta.url), { recursive: true });
const file = new URL(`./reports/${new Date().toISOString().slice(0, 10)}-${useClaude ? "claude" : "demo"}.md`, import.meta.url);
writeFileSync(file, report);
console.log(lines.join("\n"));
console.log(`\nScore: ${passed}/${cases.length} (${score}%). Report saved to ${file.pathname}`);
process.exitCode = score >= 90 ? 0 : 1;
