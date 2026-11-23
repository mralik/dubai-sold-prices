import { AlertCircle, MessageCircleQuestion, RefreshCw } from "lucide-react";
import type { AskResult } from "../api";

export { ThinkingSteps as LoadingState } from "./ThinkingSteps";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 border-red-400/30 px-6 py-5 sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0 text-red-400" aria-hidden />
      <p className="flex-1 text-sm text-ink-300">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line/15 px-3 py-1.5 text-sm font-medium text-ink-100 hover:bg-line/5">
          <RefreshCw className="size-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

const SUGGESTIONS = ["Median 1-bed price in Dubai Marina last year", "How many villa sales in Palm Jumeirah in 2025?"];

export function UnsupportedState({ result, onPick }: { result: AskResult; onPick: (q: string) => void }) {
  return (
    <section className="card px-6 py-6 sm:px-8">
      <p className="flex items-start gap-3 font-display text-lg font-semibold text-ink-100">
        <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-ink-400" aria-hidden />
        {result.unsupported}
      </p>
      <p className="mt-2 text-sm text-ink-400">I answer questions about past sale prices and sales volumes. Try one of these:</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((q) => (
          <li key={q}>
            <button type="button" onClick={() => onPick(q)} className="focus-ring rounded-full border border-line/10 bg-line/[0.03] px-3.5 py-1.5 text-sm text-ink-300 hover:border-gulf-400/40 hover:text-gulf-300">
              {q}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
