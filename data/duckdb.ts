import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
export const sqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

export async function withDuckDb<T>(fn: (connection: DuckDBConnection) => Promise<T>): Promise<T> {
  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  try {
    return await fn(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

export async function rows(connection: DuckDBConnection, sql: string): Promise<Record<string, unknown>[]> {
  const reader = await connection.runAndReadAll(sql);
  return reader.getRowObjectsJson() as Record<string, unknown>[];
}

