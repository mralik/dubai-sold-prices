import { CornerDownRight } from "lucide-react";

export function Examples({ examples, onPick, disabled }: { examples: string[]; onPick: (q: string) => void; disabled: boolean }) {
  if (examples.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-ink-500 uppercase">Try asking</p>
      <ul className="flex flex-wrap justify-center gap-2">
        {examples.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(q)}
              className="focus-ring group inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-line/[0.03] px-3.5 py-1.5 text-left text-sm text-ink-300 backdrop-blur transition hover:border-gulf-400/40 hover:bg-gulf-400/[0.06] hover:text-gulf-300 disabled:opacity-40"
            >
              <CornerDownRight className="size-3.5 text-ink-500 transition group-hover:text-gulf-300" aria-hidden />
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
