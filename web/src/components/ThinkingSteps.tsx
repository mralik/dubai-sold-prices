import { Check, Loader2, SearchCheck } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = ["Reading your question", "Building a safe, read-only query", "Calculating from sale records", "Writing the answer"];

export function ThinkingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card px-6 py-6" aria-label="Working on your answer">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-300">
        <SearchCheck className="size-4 text-gulf-300" aria-hidden /> Checking the records
      </p>
      <ol className="mt-4 space-y-3">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 text-sm transition ${i <= step ? "text-ink-100" : "text-ink-500"}`}>
            <span className={`grid size-6 place-items-center rounded-full border ${i <= step ? "border-gulf-400 bg-gulf-400/10 text-gulf-300" : "border-night-600"}`}>
              {i < step ? <Check className="size-3.5" aria-hidden /> : i === step ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            </span>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
