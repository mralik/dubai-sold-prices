// One small interface over the database, so the same SQL runs locally
// (sql.js, see db.ts) and on Cloudflare (D1, see worker/d1.ts).

export type SqlValue = string | number | null;

export interface SqlBackend {
  all<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

let backend: SqlBackend | null = null;
let loader: (() => Promise<SqlBackend>) | null = null;

/** Use this backend for every query from now on. */
export function useDatabase(next: SqlBackend): void {
  backend = next;
}

/** Create the backend on the first query. Used by the local sql.js database. */
export function useDatabaseLoader(next: () => Promise<SqlBackend>): void {
  loader = next;
}

/** Runs a read-only, parameterised query and returns rows as objects. */
export async function query<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error("Only SELECT queries are allowed.");
  if (!backend && loader) backend = await loader();
  if (!backend) throw new Error("No database is configured.");
  return backend.all<T>(sql, params);
}
