import { importDldCsv } from "./importer";

const input = process.argv[2] ?? "data/raw/dld_transactions.csv";
const output = process.argv[3] ?? "data/processed/sales.parquet";
const args = process.argv.slice(4);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

importDldCsv(input, output, { from: flag("--from"), to: flag("--to") }).then((result) => {
  console.log(JSON.stringify(result, null, 2));
  const counts = Object.values(result.keptByMonth);
  const average = counts.reduce((sum, count) => sum + count, 0) / Math.max(1, counts.length);
  const lowMonths = Object.entries(result.keptByMonth).filter(([, count]) => count < average * 0.7);
  if (lowMonths.length) console.warn(`Warning: months below 70% of the average (${Math.round(average)}): ${lowMonths.map(([month, count]) => `${month} (${count})`).join(", ")}`);
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

