import { lazy, Suspense, useEffect, useState } from "react";
import { getSnapshot, type Snapshot } from "../api";
import { aed, num } from "../format";
import { SnapshotSkeleton } from "./SnapshotSkeleton";

const Sparkline = lazy(() => import("./Sparkline"));

let memory: Snapshot | null = null;

function Spark({ values, label }: { values: number[]; label: string }) {
  return (
    <Suspense fallback={<span className="inline-block h-8 w-24 animate-pulse rounded bg-line/10" aria-hidden />}>
      <Sparkline values={values} label={label} />
    </Suspense>
  );
}

function changeLabel(value: number): string {
  const abs = Math.abs(value).toFixed(1).replace(/\.0$/, "");
  return `${value > 0 ? "+" : "−"}${abs}%`;
}

export default function HomeSnapshot({ onAsk }: { onAsk: (question: string) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(memory);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (memory) return;
    const controller = new AbortController();
    getSnapshot(controller.signal)
      .then((data) => {
        memory = data;
        setSnapshot(data);
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "The snapshot could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return <section className="card px-5 py-4 text-sm text-ink-300" role="alert">{error}</section>;
  }
  if (!snapshot) return <SnapshotSkeleton />;

  const { registration } = snapshot;
  return (
    <section className="overflow-x-hidden" aria-labelledby="snapshot-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="snapshot-heading" className="font-display text-2xl font-bold text-ink-100">Latest month · {snapshot.monthLabel}</h2>
        </div>
        {snapshot.sampleData && <p className="rounded-full border border-line/10 bg-line/[0.04] px-3 py-1 text-xs font-semibold tracking-wide text-ink-300 uppercase">Sample data</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card min-w-0 px-4 py-4 sm:px-5" aria-labelledby="busiest-heading">
          <h3 id="busiest-heading" className="text-sm font-semibold text-ink-100">Busiest places</h3>
          <p className="mt-1 text-xs text-ink-500">Most sales in {snapshot.monthLabel}.</p>
          <ol className="mt-3 divide-y divide-line/10">
            {snapshot.busiest.map((place, index) => (
              <li key={`${place.kind}-${place.officialName}`}>
                <button type="button" onClick={() => onAsk(place.question)} className="focus-ring flex w-full min-w-0 items-center gap-3 rounded-xl py-3 text-left hover:bg-line/[0.03]">
                  <span className="w-5 shrink-0 font-display text-sm font-bold text-ink-500">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <PlaceName place={place} />
                    <span className="mt-0.5 block text-xs text-ink-400">{num(place.sales)} sales · median {aed(place.medianPrice)}</span>
                  </span>
                  <span className="shrink-0">
                    <Spark values={place.sparkline} label={`${place.name} sales over 6 months`} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">Sales counts for recent months may rise as late registrations are added.</p>
        </section>

        <section className="card min-w-0 px-4 py-4 sm:px-5" aria-labelledby="change-heading">
          <h3 id="change-heading" className="text-sm font-semibold text-ink-100">Price per sq ft change, like-for-like</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">Compares the same property types and bedroom counts in both periods. Last 3 months compared with the 3 months before.</p>
          <div className="mt-4 grid gap-4">
            <ChangeList title="Up" places={snapshot.rising} onAsk={onAsk} />
            <ChangeList title="Down" places={snapshot.falling} onAsk={onAsk} />
            <LaunchList launches={snapshot.launches} onAsk={onAsk} />
          </div>
        </section>

        <section className="card min-w-0 px-4 py-4 sm:px-5 lg:col-span-2" aria-labelledby="mix-heading">
          <h3 id="mix-heading" className="text-sm font-semibold text-ink-100">Off-plan and ready</h3>
          <p className="mt-1 text-xs text-ink-500">Share of sales in {snapshot.monthLabel}.</p>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-line/10" aria-hidden>
            {registration.offPlan > 0 && (
              <span className="h-full bg-gulf-400" style={{ width: registration.ready === 0 ? "100%" : `${registration.offPlanShare}%` }} />
            )}
            {registration.ready > 0 && <span className="h-full min-w-0 flex-1 bg-gold-400" />}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => onAsk(registration.offPlanQuestion)} className="focus-ring rounded-xl border border-line/10 px-3 py-3 text-left hover:border-gulf-400/40">
              <span className="block text-xs text-ink-500">Off-plan</span>
              <span className="mt-1 block font-semibold text-ink-100">{registration.offPlanShare}% · {num(registration.offPlan)} sales</span>
            </button>
            <button type="button" onClick={() => onAsk(registration.readyQuestion)} className="focus-ring rounded-xl border border-line/10 px-3 py-3 text-left hover:border-gold-400/40">
              <span className="block text-xs text-ink-500">Ready</span>
              <span className="mt-1 block font-semibold text-ink-100">{registration.readyShare}% · {num(registration.ready)} sales</span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function PlaceName({ place }: { place: { name: string; subtitle: string | null } }) {
  return (
    <span className="min-w-0 flex-1 font-semibold text-ink-100">
      {place.name}
      {place.subtitle ? <span className="font-normal text-ink-400"> · {place.subtitle}</span> : null}
    </span>
  );
}

function LaunchList({ launches, onAsk }: { launches: Snapshot["launches"]; onAsk: (question: string) => void }) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-[0.14em] text-ink-500 uppercase">Recent sales surges</h4>
      {launches.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">No recent sales surges qualified.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line/10">
          {launches.map((launch) => (
            <li key={`${launch.name}-${launch.registration}-${launch.propertyType}-${launch.rooms}`}>
              <button type="button" onClick={() => onAsk(launch.question)} className="focus-ring flex w-full min-w-0 rounded-xl py-2.5 text-left hover:bg-line/[0.03]">
                <span className="min-w-0 font-medium text-ink-100">{launch.name} · {launch.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChangeList({ title, places, onAsk }: { title: string; places: Snapshot["rising"]; onAsk: (question: string) => void }) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-[0.14em] text-ink-500 uppercase">{title}</h4>
      {places.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">No places qualified.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line/10">
          {places.map((place) => (
            <li key={`${place.kind}-${place.officialName}`}>
              <button type="button" onClick={() => onAsk(place.question)} className="focus-ring flex w-full min-w-0 items-start justify-between gap-3 rounded-xl py-2.5 text-left hover:bg-line/[0.03]">
                <PlaceName place={place} />
                <span className={`shrink-0 font-semibold ${place.changePct > 0 ? "text-gulf-300" : "text-gold-300"}`}>{changeLabel(place.changePct)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
