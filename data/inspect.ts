import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { DLD_MAPPING, REQUIRED_DLD_COLUMNS } from "./dldMapping";
import { rows, sqlIdentifier, sqlString, withDuckDb } from "./duckdb";

export interface Inspection {
  columns: { column_name: string; column_type: string }[];
  rowCount: number;
  missingRequiredColumns: string[];
}

const SENSITIVE = /(^|_)(first_name|last_name|full_name|email|phone|mobile|passport|emirates_id|owner|buyer|seller)(_|$)/i;

export async function inspectCsv(file: string, print = true): Promise<Inspection> {
  const path = resolve(file);
  if (!/[?*[]/.test(path)) await access(path);
  return withDuckDb(async (db) => {
    const source = `read_csv_auto(${sqlString(path)}, header=true, sample_size=-1, null_padding=true)`;
    const described = await rows(db, `DESCRIBE SELECT * FROM ${source}`);
    const columns = described.map((r) => ({ column_name: String(r.column_name), column_type: String(r.column_type) }));
    const names = new Set(columns.map((c) => c.column_name));
    const missingRequiredColumns = REQUIRED_DLD_COLUMNS.filter((c) => !names.has(c));
    const countRows = await rows(db, `SELECT count(*) AS count FROM ${source}`);
    const rowCount = Number(countRows[0]?.count ?? 0);
    const safeColumns = columns.map((c) => c.column_name).filter((c) => !SENSITIVE.test(c));
    const samples = safeColumns.length ? await rows(db, `SELECT ${safeColumns.map(sqlIdentifier).join(", ")} FROM ${source} LIMIT 5`) : [];

    if (print) {
      console.log("DLD CSV inspection (read-only)");
      console.table(columns);
      console.log(`Rows: ${rowCount.toLocaleString("en-US")}`);
      console.log("First 5 rows (possible personal-data columns excluded):");
      console.table(samples);
      if (columns.some((c) => SENSITIVE.test(c.column_name))) {
        console.warn("Possible personal-data columns detected and excluded from sample output/import:", columns.filter((c) => SENSITIVE.test(c.column_name)).map((c) => c.column_name).join(", "));
      }
      if (missingRequiredColumns.length) {
        console.error("This file is missing columns the app needs:", missingRequiredColumns.join(", "));
      } else {
        for (const key of ["transactionGroup", "procedure", "usage", "propertyType", "propertySubType", "rooms"] as const) {
          const column = DLD_MAPPING[key];
          const values = await rows(db, `SELECT ${sqlIdentifier(column)} AS value, count(*) AS count FROM ${source} GROUP BY 1 ORDER BY count DESC LIMIT 30`);
          console.log(`Distinct ${column}:`);
          console.table(values);
        }
        const dateColumn = sqlIdentifier(DLD_MAPPING.date);
        console.table(await rows(db, `SELECT min(try_cast(${dateColumn} AS DATE)) AS earliest, max(try_cast(${dateColumn} AS DATE)) AS latest FROM ${source}`));
      }
    }
    return { columns, rowCount, missingRequiredColumns };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] ?? "data/raw/dld_transactions.csv";
  inspectCsv(file).then((result) => {
    if (result.missingRequiredColumns.length) process.exitCode = 1;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

