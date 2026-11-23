import { BrainCircuit, ChevronDown, Code2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { AskResult } from "../api";

export function Interpretation({ result }: { result: AskResult }) {
  const [showSql, setShowSql] = useState(false);
  const { planner } = result;
  return (
    <section className="card px-5 py-5 sm:px-7" aria-labelledby="interp-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="interp-heading" className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <BrainCircuit className="size-4 text-ink-500" aria-hidden />
          How your question was read
        </h2>
        <span className="inline-flex items-center gap-2 text-xs text-ink-400">
          {planner.mode === "claude" ? planner.model : "Built-in reader"}
          {planner.costUsd !== null && <span className="text-ink-500">· ${planner.costUsd.toFixed(4)}</span>}
          <span className="rounded-full bg-line/5 px-2 py-0.5 text-ink-400">{result.timingMs} ms</span>
        </span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {result.interpretation.map((part) => (
          <li key={part} className="rounded-lg border border-line/10 bg-line/[0.03] px-2.5 py-1 text-sm text-ink-300">{part}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-500">Not quite right? Add the area, bedrooms, property type or period.</p>
      {result.sql && (
        <div className="mt-4 border-t border-line/[0.06] pt-4">
          <button
            type="button"
            onClick={() => setShowSql((s) => !s)}
            aria-expanded={showSql}
            className="focus-ring inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-gulf-300 hover:text-gulf-400"
          >
            <Code2 className="size-3.5" aria-hidden />
            {showSql ? "Hide" : "Show"} the safe SQL my code generated
            <ChevronDown className={`size-3.5 transition ${showSql ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showSql && (
            <div className="mt-3">
              <pre className="overflow-x-auto rounded-xl border border-line/[0.06] bg-night-950 p-4 font-mono text-xs leading-relaxed text-gulf-300"><code>{result.sql}</code></pre>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-400">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gulf-300" aria-hidden />
                The question reader never writes SQL. It fills in a fixed query plan, and code builds this read-only query with a placeholder (?) for every value.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
