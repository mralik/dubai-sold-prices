// Writes the processed DLD sales as SQL files for Cloudflare D1, into data/d1/:
//   0-schema.sql         the sales table
//   1-rows-01.sql ...    the rows, in files of at most ROWS_PER_FILE
// On D1's free plan each row written counts towards 100,000 rows a day, so load
// one row file a day.
//
//   tsx data/d1Export.ts

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { DLD_PARQUET_PATH } from "../server/dataMode";
import { rows, sqlString, withDuckDb } from "./duckdb";

const ROWS_PER_FILE = 90_000;
const ROWS_PER_INSERT = 150;

// Stored sorted by area and date (WITHOUT ROWID with that primary key), so a
// question about one area reads only that area's rows. This needs no extra
// index, and on D1's free plan every index adds one more write per row.
export const SCHEMA = `CREATE TABLE IF NOT EXISTS sales (
  transaction_id TEXT NOT NULL,
  instance_date  TEXT NOT NULL,
  area_name_en   TEXT NOT NULL,
  master_project TEXT NOT NULL,
  project_name   TEXT NOT NULL,
  property_type  TEXT NOT NULL,
  rooms          TEXT NOT NULL,
  registration   TEXT NOT NULL,
  size_sqft      REAL NOT NULL,
  price_aed      INTEGER NOT NULL,
  price_per_sqft REAL NOT NULL,
  PRIMARY KEY (area_name_en, instance_date, transaction_id)
) WITHOUT ROWID;
`;

const COLUMNS = ["transaction_id", "instance_date", "area_name_en", "master_project", "project_name", "property_type", "rooms", "registration", "size_sqft", "price_aed", "price_per_sqft"] as const;

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return "''";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
};

const outDir = new URL("./d1/", import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) if (file.endsWith(".sql")) rmSync(new URL(file, outDir));

const sales = await withDuckDb((duckdb) => rows(duckdb, `SELECT ${COLUMNS.join(", ")} FROM read_parquet(${sqlString(DLD_PARQUET_PATH)}) ORDER BY transaction_id`));

writeFileSync(new URL("0-schema.sql", outDir), SCHEMA);
let files = 0;
for (let start = 0; start < sales.length; start += ROWS_PER_FILE) {
  const chunk = sales.slice(start, start + ROWS_PER_FILE);
  const statements: string[] = [];
  for (let i = 0; i < chunk.length; i += ROWS_PER_INSERT) {
    const values = chunk.slice(i, i + ROWS_PER_INSERT).map((row) =>
      `(${COLUMNS.map((column) => literal(column === "price_aed" ? Math.round(Number(row[column])) : column.endsWith("_sqft") ? Number(row[column]) : row[column])).join(",")})`);
    statements.push(`INSERT INTO sales (${COLUMNS.join(",")}) VALUES\n${values.join(",\n")};`);
  }
  files++;
  writeFileSync(new URL(`1-rows-${String(files).padStart(2, "0")}.sql`, outDir), `${statements.join("\n")}\n`);
}
console.log(`Wrote ${sales.length.toLocaleString("en-US")} sales into ${files} row file(s) in data/d1/.`);
