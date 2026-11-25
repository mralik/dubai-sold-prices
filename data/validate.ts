import { DLD_PARQUET_PATH } from "../server/dataMode";
import { rows, sqlString, withDuckDb } from "./duckdb";

const EXPECTED_COLUMNS = [
  "transaction_id", "instance_date", "area_name_en", "master_project", "project_name", "property_type",
  "rooms", "registration", "size_sqft", "price_aed", "price_per_sqft",
];

async function main() {
  if (process.env.DATA_MODE !== "dld") throw new Error("Run validation with DATA_MODE=dld.");
  const file = DLD_PARQUET_PATH;
  const source = `read_parquet(${sqlString(file)})`;
  const candidates = await withDuckDb(async (db) => {
    const schema = await rows(db, `DESCRIBE SELECT * FROM ${source}`);
    const columns = schema.map((column) => String(column.column_name));
    if (JSON.stringify(columns) !== JSON.stringify(EXPECTED_COLUMNS)) throw new Error(`Unexpected schema: ${columns.join(", ")}`);
    const [checks] = await rows(db, `SELECT
      count(*) AS rows,
      count(*) - count(DISTINCT transaction_id) AS duplicates,
      count(*) FILTER (WHERE transaction_id IS NULL OR instance_date IS NULL OR area_name_en IS NULL OR master_project IS NULL OR property_type IS NULL OR rooms IS NULL OR registration IS NULL) AS missing,
      count(*) FILTER (WHERE size_sqft <= 0 OR price_aed <= 0 OR price_per_sqft NOT BETWEEN 100 AND 20000) AS impossible,
      min(instance_date) AS earliest,
      max(instance_date) AS latest
      FROM ${source}`);
    console.table([checks]);
    if (Number(checks?.duplicates) || Number(checks?.missing) || Number(checks?.impossible)) throw new Error("Parquet integrity checks failed.");
    const combos = await rows(db, `SELECT area_name_en, property_type, rooms, count(*) AS count
      FROM ${source} GROUP BY 1,2,3 HAVING count(*) >= 10 ORDER BY count(*) DESC LIMIT 5`);
    return combos;
  });

  await import("../server/db");
  const { ask } = await import("../server/ask");
  const comparisons: Record<string, unknown>[] = [];
  for (const candidate of candidates) {
    const area = String(candidate.area_name_en);
    const propertyType = String(candidate.property_type);
    const rooms = String(candidate.rooms);
    const roomText = rooms === "studio" ? "studio" : rooms === "5+" ? "5 bedroom" : `${rooms} bedroom`;
    const question = `What was the median price for ${roomText} ${propertyType}s in ${area} in 2026?`;
    const result = await ask(question);
    const expected = await withDuckDb(async (db) => {
      const [direct] = await rows(db, `SELECT count(*) AS count, median(price_aed) AS median_price, median(price_per_sqft) AS median_psf
        FROM read_parquet(${sqlString(file)})
        WHERE area_name_en=${sqlString(area)} AND property_type=${sqlString(propertyType)} AND rooms=${sqlString(rooms)}
          AND instance_date BETWEEN '2026-01-01' AND '2026-10-31'`);
      return direct;
    });
    const actual = result.summary;
    const ok = Boolean(actual)
      && Number(expected?.count) === actual?.count
      && Math.round(Number(expected?.median_price)) === actual?.medianPrice
      && Math.round(Number(expected?.median_psf)) === actual?.medianPricePerSqft;
    comparisons.push({ question, expected_count: expected?.count, app_count: actual?.count, ok });
    if (!ok) throw new Error(`Direct-query comparison failed: ${question}`);
  }
  const communityCases = [
    { question: "How much did apartments in JLT sell for?", masters: ["DMCC Master Community"], propertyType: "apartment", rooms: null },
    { question: "2-bed in Al Furjan", masters: ["Al Furjan"], propertyType: null, rooms: "2" },
  ];
  for (const testCase of communityCases) {
    const result = await ask(testCase.question);
    const expected = await withDuckDb(async (db) => {
      const filters = [`master_project IN (${testCase.masters.map(sqlString).join(", ")})`];
      if (testCase.propertyType) filters.push(`property_type=${sqlString(testCase.propertyType)}`);
      if (testCase.rooms) filters.push(`rooms=${sqlString(testCase.rooms)}`);
      const [direct] = await rows(db, `SELECT count(*) AS count, median(price_aed) AS median_price, median(price_per_sqft) AS median_psf
        FROM read_parquet(${sqlString(file)}) WHERE ${filters.join(" AND ")}`);
      return direct;
    });
    const actual = result.summary;
    const ok = result.unsupported === null
      && Boolean(actual)
      && Number(expected?.count) === actual?.count
      && Math.round(Number(expected?.median_price)) === actual?.medianPrice
      && Math.round(Number(expected?.median_psf)) === actual?.medianPricePerSqft;
    comparisons.push({ question: testCase.question, expected_count: expected?.count, app_count: actual?.count, ok });
    if (!ok) throw new Error(`Community direct-query comparison failed: ${testCase.question}`);
  }
  const damacVillasQuestion = "Villas in Damac Hills";
  const damacVillasResult = await ask(damacVillasQuestion);
  const [directDamacVillas] = await withDuckDb((db) => rows(db, `SELECT count(*) AS count, median(price_aed) AS median_price, median(price_per_sqft) AS median_psf
    FROM ${source} WHERE area_name_en='Al Hebiah Third' AND property_type='villa'`));
  const damacVillasOk = damacVillasResult.unsupported === null
    && damacVillasResult.summary?.count === Number(directDamacVillas?.count)
    && damacVillasResult.summary?.medianPrice === Math.round(Number(directDamacVillas?.median_price))
    && damacVillasResult.summary?.medianPricePerSqft === Math.round(Number(directDamacVillas?.median_psf));
  comparisons.push({ question: damacVillasQuestion, expected_count: directDamacVillas?.count, app_count: damacVillasResult.summary?.count, ok: damacVillasOk });
  if (!damacVillasOk) throw new Error(`Direct-query comparison failed: ${damacVillasQuestion}`);
  const trendQuestion = "JVC 1-bed price per sq ft month by month";
  const trendResult = await ask(trendQuestion);
  const directTrend = await withDuckDb((db) => rows(db, `SELECT substr(instance_date, 1, 7) AS month, count(*) AS count
    FROM ${source} WHERE area_name_en='Al Barsha South Fourth' AND rooms='1' AND instance_date BETWEEN '2025-11-01' AND '2026-10-31'
    GROUP BY 1 ORDER BY 1`));
  const appTrendCounts = trendResult.series.map((point, index) => ({ month: point.month, count: trendResult.seriesCounts[index]?.value ?? 0 }));
  const trendOk = JSON.stringify(appTrendCounts) === JSON.stringify(directTrend.map((row) => ({ month: String(row.month), count: Number(row.count) })));
  comparisons.push({ question: trendQuestion, direct_months: directTrend.length, app_months: appTrendCounts.length, ok: trendOk });
  if (!trendOk) throw new Error(`Trend count validation failed: ${trendQuestion}`);

  const lastSixQuestion = "What did 2 bedroom flats go for lately?";
  const lastSixResult = await ask(lastSixQuestion);
  const [directLastSix] = await withDuckDb((db) => rows(db, `SELECT count(*) AS count, median(price_aed) AS median_price FROM ${source}
    WHERE property_type='apartment' AND rooms='2' AND instance_date BETWEEN '2026-05-01' AND '2026-10-31'`));
  const lastSixOk = lastSixResult.summary?.count === Number(directLastSix?.count) && lastSixResult.summary?.medianPrice === Math.round(Number(directLastSix?.median_price));
  comparisons.push({ question: lastSixQuestion, expected_count: directLastSix?.count, app_count: lastSixResult.summary?.count, ok: lastSixOk });
  if (!lastSixOk) throw new Error(`Last-six-month validation failed: ${lastSixQuestion}`);

  const mixedQuestion = "Compare JLT and JVC 1-bed prices";
  const mixedResult = await ask(mixedQuestion);
  const directMixed = await withDuckDb((db) => rows(db, `SELECT place, count(*) AS count, median(price_aed) AS median_price FROM (
      SELECT CASE WHEN master_project='DMCC Master Community' THEN 'JLT' WHEN area_name_en='Al Barsha South Fourth' THEN 'JVC (Al Barsha South Fourth)' END AS place, price_aed
      FROM ${source} WHERE rooms='1' AND (master_project='DMCC Master Community' OR area_name_en='Al Barsha South Fourth')
    ) WHERE place IS NOT NULL GROUP BY place ORDER BY place`));
  const directMixedMap = new Map(directMixed.map((row) => [String(row.place), { count: Number(row.count), median: Math.round(Number(row.median_price)) }]));
  const mixedOk = mixedResult.areas.length === 2 && mixedResult.areas.every((area) => area.count === directMixedMap.get(area.area)?.count && area.medianPrice === directMixedMap.get(area.area)?.median);
  comparisons.push({ question: mixedQuestion, expected_count: directMixed.reduce((sum, row) => sum + Number(row.count), 0), app_count: mixedResult.summary?.count, ok: mixedOk });
  if (!mixedOk) throw new Error(`Mixed-place validation failed: ${mixedQuestion}`);

  const allAreasQuestion = "Median apartment price in all areas this year";
  const allAreasResult = await ask(allAreasQuestion);
  const [directAllAreas] = await withDuckDb((db) => rows(db, `SELECT count(*) AS count, median(price_aed) AS median_price FROM ${source}
    WHERE property_type='apartment' AND instance_date BETWEEN '2026-01-01' AND '2026-10-31'`));
  const allAreasCount = Number(directAllAreas?.count);
  const allAreasOk = allAreasCount > 20_000 && allAreasResult.summary?.count === allAreasCount && allAreasResult.summary?.medianPrice === Math.round(Number(directAllAreas?.median_price));
  comparisons.push({ question: allAreasQuestion, expected_count: allAreasCount, app_count: allAreasResult.summary?.count, ok: allAreasOk });
  if (!allAreasOk) throw new Error(`All-areas validation failed: ${allAreasQuestion}`);
  console.table(comparisons);
  console.log("DLD validation passed: schema, integrity and 12 direct-query comparisons, including unknown-bedroom villas, trend counts, last 6 months, mixed places and an all-areas median over 20,000 rows.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

