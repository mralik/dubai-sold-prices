// Cloudflare D1 as the app's database (see server/database.ts).

import type { SqlBackend, SqlValue } from "../server/database";

export interface D1Result<T> {
  results: T[];
  meta?: { rows_read?: number; duration?: number };
}

export interface D1Database {
  prepare(sql: string): { bind(...values: SqlValue[]): { all<T>(): Promise<D1Result<T>> } };
}

/** Rows read by the queries of the current request, for logging. */
export let rowsRead = 0;

export function d1Backend(db: D1Database): SqlBackend {
  rowsRead = 0;
  return {
    async all<T>(sql: string, params: SqlValue[]): Promise<T[]> {
      const result = await db.prepare(sql).bind(...params).all<T>();
      rowsRead += result.meta?.rows_read ?? 0;
      return result.results;
    },
  };
}
