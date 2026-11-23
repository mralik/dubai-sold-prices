import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { importDldCsv } from "../data/importer";
import { rows, sqlString, withDuckDb } from "../data/duckdb";

const tempDirs: string[] = [];
afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("DLD fixture import", () => {
  it("keeps clean residential sales and counts every rejected row", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dld-import-"));
    tempDirs.push(dir);
    const output = join(dir, "sales.parquet");
    const fixture = resolve("tests/fixtures/dld_transactions.csv");
    const result = await importDldCsv(fixture, output, { from: "2026-09", to: "2026-09" });

    expect(result.kept).toBe(20);
    expect(result.dropped).toMatchObject({
      not_sale: 1,
      not_residential: 1,
      invalid_price: 1,
      invalid_size: 1,
      duplicate: 1,
      unsupported_rooms: 1,
      unsupported_property_type: 1,
      unsupported_registration: 1,
      implausible_price_per_sqft: 1,
      outside_range: 1,
    });
    expect(result.keptByMonth).toEqual({ "2026-09": 20 });
    expect(result).not.toHaveProperty("month");
    const metadata = JSON.parse(await readFile(`${output}.meta.json`, "utf8")) as { attribution: string };
    expect(metadata.attribution).toBe("Source: Dubai Land Department, via data.dubai (Open Data License)");

    await withDuckDb(async (db) => {
      const schema = await rows(db, `DESCRIBE SELECT * FROM read_parquet(${sqlString(output)})`);
      expect(schema.map((column) => column.column_name)).toEqual([
        "transaction_id", "instance_date", "area_name_en", "master_project", "project_name", "property_type",
        "rooms", "registration", "size_sqft", "price_aed", "price_per_sqft",
      ]);
      const [converted] = await rows(db, `SELECT size_sqft FROM read_parquet(${sqlString(output)}) WHERE transaction_id='T001'`);
      expect(Number(converted?.size_sqft)).toBeCloseTo(484.38, 2);
    });
  });
});
