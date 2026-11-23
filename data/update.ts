import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { importDldCsv } from "./importer";

const FILE_NAME = /^transactions_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_\d+\.csv$/;

/** CSV parts from the latest data.dubai export in a file list. */
export function newestTransactionCsvs(fileNames: string[]): string[] {
  const matches = fileNames.flatMap((name) => {
    const match = FILE_NAME.exec(name);
    return match?.[1] ? [{ name, stamp: match[1] }] : [];
  });
  const newest = matches.map((file) => file.stamp).sort().at(-1);
  if (!newest) return [];
  return matches.filter((file) => file.stamp === newest).map((file) => file.name).sort();
}

async function main(): Promise<void> {
  const dir = resolve("data/raw");
  const files = newestTransactionCsvs(await readdir(dir));
  if (files.length === 0) throw new Error("No transaction CSVs found in data/raw/.");
  const stamp = FILE_NAME.exec(files[0]!)?.[1];
  if (!stamp) throw new Error("No transaction CSVs found in data/raw/.");
  console.log(`Importing ${files.join(", ")}`);
  const result = await importDldCsv(resolve(dir, `transactions_${stamp}_*.csv`), resolve("data/processed/sales.parquet"));
  console.log(`Imported ${result.kept.toLocaleString("en-US")} sales, ${result.from} to ${result.to}. Latest included ${result.latestIncludedDate}.`);
  const counts = Object.values(result.keptByMonth);
  const average = counts.reduce((sum, count) => sum + count, 0) / Math.max(1, counts.length);
  const lowMonths = Object.entries(result.keptByMonth).filter(([, count]) => count < average * 0.7);
  if (lowMonths.length) console.warn(`Warning: months below 70% of the average (${Math.round(average)}): ${lowMonths.map(([month, count]) => `${month} (${count})`).join(", ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
