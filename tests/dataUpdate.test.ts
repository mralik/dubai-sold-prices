import { describe, expect, it } from "vitest";
import { newestTransactionCsvs } from "../data/update";

describe("data update", () => {
  it("imports only the newest CSV export", () => {
    expect(newestTransactionCsvs([
      "transactions_2026-10-01_09-00-00_0001.csv",
      "transactions_2026-11-20_17-50-42_0002.csv",
      "transactions_2026-11-20_17-50-42_0001.csv",
      "notes.txt",
    ])).toEqual([
      "transactions_2026-11-20_17-50-42_0001.csv",
      "transactions_2026-11-20_17-50-42_0002.csv",
    ]);
  });
});