import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type DataMode = "sample" | "dld";

export interface DldMetadata {
  sourceLabel: string;
  attribution: string;
  dateFrom: string;
  dateTo: string;
  latestDate: string;
  latestIncludedDate?: string;
  keptByMonth?: Record<string, number>;
  areas: string[];
  kept: number;
}

/** The Cloudflare Worker has no file system, so it sets the metadata here first (worker/setup.ts). */
const injected = (globalThis as { __DLD_METADATA__?: DldMetadata }).__DLD_METADATA__;

export const DATA_MODE: DataMode = process.env.DATA_MODE === "dld" ? "dld" : "sample";
export const DLD_PARQUET_PATH = injected ? "" : fileURLToPath(new URL("../data/processed/sales.parquet", import.meta.url));

function readDldMetadata(): DldMetadata {
  if (injected) return injected;
  const metadataUrl = new URL("../data/processed/sales.parquet.meta.json", import.meta.url);
  if (!existsSync(DLD_PARQUET_PATH) || !existsSync(metadataUrl)) {
    throw new Error("DATA_MODE=dld requires data/processed/sales.parquet. Run npm run data:import first.");
  }
  return JSON.parse(readFileSync(metadataUrl, "utf8")) as DldMetadata;
}

export const DLD_METADATA = DATA_MODE === "dld" ? readDldMetadata() : null;

export const DATA_INFO = DATA_MODE === "dld" && DLD_METADATA ? {
  mode: DATA_MODE,
  from: DLD_METADATA.dateFrom.slice(0, 7),
  to: DLD_METADATA.dateTo.slice(0, 7),
  latestTransactionDate: DLD_METADATA.latestIncludedDate ?? DLD_METADATA.dateTo,
  sourceLabel: DLD_METADATA.sourceLabel,
  attribution: DLD_METADATA.attribution,
  sampleData: false,
} as const : {
  mode: "sample" as const,
  from: "2024-01",
  to: "2026-10",
  latestTransactionDate: "2026-10-31",
  sourceLabel: "Sample data",
  attribution: "Synthetic data for demonstration only. Not affiliated with Dubai Land Department.",
  sampleData: true,
} as const;

