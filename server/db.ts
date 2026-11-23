// SQLite database in memory, using sql.js (SQLite compiled to WebAssembly).
// It runs the same SQL as Cloudflare D1, so the queries move over unchanged.

import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { rows, sqlString, withDuckDb } from "../data/duckdb";
import { DATA_MODE, DLD_PARQUET_PATH } from "./dataMode";
import { generateSales } from "./sampleData";
import type { SaleRecord } from "./sampleData";

let dbPromise: Promise<Database> | null = null;

const SCHEMA = `
  CREATE TABLE sales (
    transaction_id TEXT PRIMARY KEY,
    instance_date  TEXT NOT NULL,
    area_name_en   TEXT NOT NULL,
    master_project TEXT NOT NULL,
    project_name   TEXT NOT NULL,
    property_type  TEXT NOT NULL,
    rooms          TEXT NOT NULL,
    registration   TEXT NOT NULL,
    size_sqft      REAL NOT NULL,
    price_aed      INTEGER NOT NULL,
    price_per_sqft REAL NOT NULL
  );
  CREATE INDEX idx_sales_area_date ON sales (area_name_en, instance_date);
  CREATE INDEX idx_sales_date ON sales (instance_date);
`;

async function createDb(): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(SCHEMA);
  const insert = db.prepare(
    "INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  db.run("BEGIN");
  const sales = DATA_MODE === "dld" ? await loadDldSales() : generateSales();
  for (const r of sales) {
    insert.run([
      r.transaction_id, r.instance_date, r.area_name_en, r.master_project ?? r.area_name_en, r.project_name, r.property_type,
      r.rooms, r.registration, r.size_sqft, r.price_aed, r.price_per_sqft,
    ]);
  }
  db.run("COMMIT");
  insert.free();
  return db;
}

async function loadDldSales(): Promise<SaleRecord[]> {
  return withDuckDb(async (duckdb) => {
    const result = await rows(duckdb, `SELECT * FROM read_parquet(${sqlString(DLD_PARQUET_PATH)})`);
    return result.map((row) => ({
      transaction_id: String(row.transaction_id),
      instance_date: String(row.instance_date),
      area_name_en: String(row.area_name_en),
      master_project: String(row.master_project),
      project_name: String(row.project_name),
      property_type: String(row.property_type) as SaleRecord["property_type"],
      rooms: String(row.rooms) as SaleRecord["rooms"],
      registration: String(row.registration) as SaleRecord["registration"],
      size_sqft: Number(row.size_sqft),
      price_aed: Number(row.price_aed),
      price_per_sqft: Number(row.price_per_sqft),
    }));
  });
}

export function getDb(): Promise<Database> {
  dbPromise ??= createDb();
  return dbPromise;
}

/** Runs a read-only, parameterised query and returns rows as objects. */
export async function query<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  if (!/^\s*select\b/i.test(sql)) throw new Error("Only SELECT queries are allowed.");
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}
