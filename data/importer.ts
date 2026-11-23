import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DLD_MAPPING as m } from "./dldMapping";
import { rows, sqlIdentifier as q, sqlString as s, withDuckDb } from "./duckdb";
import { inspectCsv } from "./inspect";

export interface ImportResult {
  from: string;
  to: string;
  kept: number;
  keptByMonth: Record<string, number>;
  dropped: Record<string, number>;
  dateFrom: string;
  dateTo: string;
  latestDate: string;
  latestIncludedDate: string;
  areas: string[];
}

export interface ImportRange { from?: string; to?: string }

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
function addMonths(month: string, amount: number): string {
  const [year, part] = month.split("-").map(Number) as [number, number];
  const total = year * 12 + part - 1 + amount;
  return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, "0")}`;
}

function monthEnd(month: string): string {
  const [year, part] = month.split("-").map(Number) as [number, number];
  return `${month}-${new Date(Date.UTC(year, part, 0)).getUTCDate()}`;
}

const value = (name: string) => `trim(cast(${q(name)} AS VARCHAR))`;
const numeric = (name: string) => `try_cast(regexp_replace(${value(name)}, '[^0-9.-]', '', 'g') AS DOUBLE)`;

export async function importDldCsv(inputFile: string, outputFile: string, requested: ImportRange | string = {}): Promise<ImportResult> {
  const input = resolve(inputFile);
  const output = resolve(outputFile);
  const inspection = await inspectCsv(input, false);
  if (inspection.missingRequiredColumns.length) throw new Error(`DLD mapping must be confirmed. Missing columns: ${inspection.missingRequiredColumns.join(", ")}`);
  await mkdir(dirname(output), { recursive: true });

  return withDuckDb(async (db) => {
    const source = `read_csv_auto(${s(input)}, header=true, all_varchar=true, null_padding=true)`;
    const range = await rows(db, `SELECT max(try_cast(${q(m.date)} AS DATE)) AS latest FROM ${source}`);
    const latest = String(range[0]?.latest ?? "");
    if (!latest) throw new Error("No valid transaction dates were found.");
    const latestDate = latest.slice(0, 10);
    const last = new Date(`${latestDate}T00:00:00Z`);
    const isMonthEnd = last.getUTCDate() === new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)).getUTCDate();
    if (!isMonthEnd) last.setUTCMonth(last.getUTCMonth() - 1);
    const latestComplete = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}`;
    const requestedRange = typeof requested === "string" ? { from: requested, to: requested } : requested;
    const to = requestedRange.to ?? latestComplete;
    const from = requestedRange.from ?? addMonths(to, -11);
    if (!MONTH.test(from) || !MONTH.test(to) || from > to) throw new Error("Import range must use --from YYYY-MM --to YYYY-MM, with from before to.");

    const date = `try_cast(${q(m.date)} AS DATE)`;
    const price = numeric(m.priceAed);
    const sizeSqm = numeric(m.sizeSqm);
    const propertyRaw = `lower(coalesce(nullif(${value(m.propertySubType)}, ''), ${value(m.propertyType)}))`;
    const roomsRaw = `lower(${value(m.rooms)})`;
    const registrationRaw = `lower(${value(m.registration)})`;
    const typeExpr = `CASE WHEN ${propertyRaw} IN ('unit','apartment','flat','stacked townhouses') THEN 'apartment' WHEN ${propertyRaw}='villa' THEN 'villa' WHEN ${propertyRaw} IN ('townhouse','town house') THEN 'townhouse' END`;
    const roomsExpr = `CASE WHEN ${roomsRaw}='studio' THEN 'studio' WHEN regexp_matches(${roomsRaw}, '(^|[^0-9])1([^0-9]|$)') THEN '1' WHEN regexp_matches(${roomsRaw}, '(^|[^0-9])2([^0-9]|$)') THEN '2' WHEN regexp_matches(${roomsRaw}, '(^|[^0-9])3([^0-9]|$)') THEN '3' WHEN regexp_matches(${roomsRaw}, '(^|[^0-9])4([^0-9]|$)') THEN '4' WHEN regexp_matches(${roomsRaw}, '(^|[^0-9])([5-9]|[1-9][0-9])([^0-9]|$)') THEN '5+' WHEN ${propertyRaw}='villa' THEN 'unknown' END`;
    const registrationExpr = `CASE WHEN ${registrationRaw} IN ('off-plan','off plan','off-plan properties','initial sale') THEN 'off-plan' WHEN ${registrationRaw} IN ('ready','existing properties','secondary','resale') THEN 'ready' END`;

    const normalized = `
      WITH base AS (
        SELECT *, ${date} AS parsed_date, ${price} AS parsed_price, ${sizeSqm} AS parsed_size_sqm,
          ${typeExpr} AS normalized_type, ${roomsExpr} AS normalized_rooms, ${registrationExpr} AS normalized_registration
        FROM ${source}
      ), classified AS (
        SELECT *,
          CASE
            WHEN parsed_date IS NULL THEN 'invalid_date'
            WHEN strftime(parsed_date, '%Y-%m') < ${s(from)} OR strftime(parsed_date, '%Y-%m') > ${s(to)} THEN 'outside_range'
            WHEN lower(${value(m.transactionGroup)}) NOT IN ('sales','sale') THEN 'not_sale'
            WHEN lower(${value(m.usage)}) <> 'residential' THEN 'not_residential'
            WHEN normalized_type IS NULL THEN 'unsupported_property_type'
            WHEN normalized_rooms IS NULL THEN 'unsupported_rooms'
            WHEN normalized_registration IS NULL THEN 'unsupported_registration'
            WHEN parsed_price IS NULL OR parsed_price <= 0 THEN 'invalid_price'
            WHEN parsed_size_sqm IS NULL OR parsed_size_sqm <= 0 THEN 'invalid_size'
            WHEN parsed_price / (parsed_size_sqm * 10.7639) NOT BETWEEN 100 AND 20000 THEN 'implausible_price_per_sqft'
          END AS reject_reason,
          row_number() OVER (PARTITION BY ${value(m.transactionId)} ORDER BY parsed_date DESC) AS duplicate_rank
        FROM base
      )`;

    const counts = await rows(db, `${normalized} SELECT CASE WHEN reject_reason IS NULL AND duplicate_rank > 1 THEN 'duplicate' ELSE reject_reason END AS reason, count(*) AS count FROM classified GROUP BY 1`);
    const dropped: Record<string, number> = {};
    let kept = 0;
    for (const row of counts) {
      const count = Number(row.count);
      if (row.reason === null) kept = count;
      else dropped[String(row.reason)] = count;
    }
    const keptMonthRows = await rows(db, `${normalized} SELECT strftime(parsed_date, '%Y-%m') AS month, count(*) AS count FROM classified WHERE reject_reason IS NULL AND duplicate_rank = 1 GROUP BY 1 ORDER BY 1`);
    const keptByMonth = Object.fromEntries(keptMonthRows.map((row) => [String(row.month), Number(row.count)]));

    await db.run(`COPY (
        ${normalized}
        SELECT
          ${value(m.transactionId)} AS transaction_id,
          strftime(parsed_date, '%Y-%m-%d') AS instance_date,
          ${value(m.area)} AS area_name_en,
          coalesce(nullif(${value(m.masterProject)}, ''), 'Unspecified community') AS master_project,
          coalesce(nullif(${value(m.project)}, ''), 'Unspecified project') AS project_name,
          normalized_type AS property_type,
          normalized_rooms AS rooms,
          normalized_registration AS registration,
          round(parsed_size_sqm * 10.7639, 2) AS size_sqft,
          round(parsed_price)::BIGINT AS price_aed,
          round(parsed_price / (parsed_size_sqm * 10.7639), 2) AS price_per_sqft
        FROM classified WHERE reject_reason IS NULL AND duplicate_rank = 1
      ) TO ${s(output)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
    const [included] = await rows(db, `SELECT max(instance_date) AS latest FROM read_parquet(${s(output)})`);
    const areaRows = await rows(db, `SELECT DISTINCT area_name_en FROM read_parquet(${s(output)}) ORDER BY 1`);
    const result: ImportResult = {
      from, to, kept, keptByMonth, dropped,
      dateFrom: `${from}-01`,
      dateTo: monthEnd(to),
      latestDate,
      latestIncludedDate: String(included?.latest ?? ""),
      areas: areaRows.map((r) => String(r.area_name_en)),
    };
    await writeFile(`${output}.meta.json`, `${JSON.stringify({ sourceLabel: "DLD data", attribution: "Source: Dubai Land Department, via data.dubai (Open Data License)", ...result }, null, 2)}\n`, "utf8");
    return result;
  });
}

