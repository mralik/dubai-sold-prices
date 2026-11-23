import { staleDataMessage } from "../shareLink";

export function StaleDataNotice({ dataVersion, onLatest }: { dataVersion: string; onLatest: () => void }) {
  return (
    <div role="status" className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <p className="text-sm text-ink-100">{staleDataMessage(dataVersion)}</p>
      <button type="button" onClick={onLatest} className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-gulf-400 px-4 text-sm font-semibold text-night-950 hover:bg-gulf-300">
        Latest numbers
      </button>
    </div>
  );
}
