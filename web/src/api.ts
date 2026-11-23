import type { AskResult } from "../../server/ask";

export type { AskResult };

export interface Meta {
  areas: string[];
  dataFrom: string;
  dataTo: string;
  latestTransactionDate: string;
  dataSourceLabel: string;
  dataAttribution: string;
  totalSales: number;
  planner: "claude" | "demo";
  model: string | null;
  examples: string[];
  sampleData: boolean;
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? "The server didn't respond. Is the API running?");
  return data;
}

export interface SnapshotPlace {
  name: string;
  subtitle: string | null;
  officialName: string;
  kind: "area" | "community";
  sales: number;
  medianPrice: number | null;
  sparkline: number[];
  question: string;
}

export interface SnapshotChange {
  name: string;
  subtitle: string | null;
  officialName: string;
  kind: "area" | "community";
  changePct: number;
  recentMedianPsf: number;
  priorMedianPsf: number;
  recentSales: number;
  priorSales: number;
  segmentsUsed: number;
  coveragePct: number;
  propertyType: string;
  rooms: string;
  registration: string;
  question: string;
}

export interface SnapshotLaunch {
  name: string;
  detail: string;
  sales: number;
  question: string;
  propertyType: string;
  rooms: string;
  registration: string;
}

export interface Snapshot {
  sampleData: boolean;
  month: string;
  monthLabel: string;
  sparklineMonths: string[];
  periods: { latest: { from: string; to: string }; recent: { from: string; to: string }; prior: { from: string; to: string } };
  busiest: SnapshotPlace[];
  rising: SnapshotChange[];
  falling: SnapshotChange[];
  launches: SnapshotLaunch[];
  registration: {
    offPlan: number;
    ready: number;
    offPlanShare: number;
    readyShare: number;
    offPlanQuestion: string;
    readyQuestion: string;
  };
}

export const getMeta = () => fetch("/api/meta").then((r) => readJson<Meta>(r));

export const getSnapshot = (signal?: AbortSignal) => fetch("/api/snapshot", { signal }).then((r) => readJson<Snapshot>(r));

export const askQuestion = (question: string, signal?: AbortSignal) =>
  fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  }).then((r) => readJson<AskResult>(r));
