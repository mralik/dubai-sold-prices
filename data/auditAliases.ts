import { rows, withDuckDb } from "./duckdb";

await withDuckDb(async (db) => {
  console.table(await rows(db, `
    SELECT area_name_en, count(*) AS sales
    FROM read_parquet('data/processed/sales.parquet')
    GROUP BY 1 ORDER BY sales DESC LIMIT 25
  `));
  console.table(await rows(db, `
    WITH top_areas AS (
      SELECT area_name_en FROM read_parquet('data/processed/sales.parquet')
      GROUP BY 1 ORDER BY count(*) DESC LIMIT 25
    ), projects AS (
      SELECT raw.area_name_en, raw.master_project_en, count(*) AS transactions,
        row_number() OVER (PARTITION BY raw.area_name_en ORDER BY count(*) DESC) AS rank
      FROM read_csv_auto('data/raw/transactions_*.csv', header=true) raw
      JOIN top_areas USING (area_name_en)
      WHERE raw.instance_date >= DATE '2026-10-01' AND raw.instance_date < DATE '2026-11-01'
        AND raw.trans_group_en = 'Sales' AND raw.property_usage_en = 'Residential'
      GROUP BY 1, 2
    )
    SELECT area_name_en, master_project_en, transactions
    FROM projects WHERE rank <= 5 ORDER BY area_name_en, transactions DESC
  `));
  console.table(await rows(db, `
    SELECT master_project_en, area_name_en, count(*) AS transactions
    FROM read_csv_auto('data/raw/transactions_*.csv', header=true)
    WHERE instance_date >= DATE '2026-10-01' AND instance_date < DATE '2026-11-01'
      AND master_project_en IN ('Jumeirah Lakes Towers', 'TOWN SQUARE', 'Damac Hills', 'DAMAC HILLS', 'Dubai South Residential District', 'Meydan One Community', 'Dubai Sports City', 'Motor City', 'Jumeirah Village Triangle')
    GROUP BY 1, 2 ORDER BY 1, transactions DESC
  `));
  console.table(await rows(db, `
    SELECT master_project_en, area_name_en, count(*) AS transactions
    FROM read_csv_auto('data/raw/transactions_*.csv', header=true)
    WHERE instance_date >= DATE '2026-10-01' AND instance_date < DATE '2026-11-01'
      AND lower(master_project_en) IN ('dmcc-ez2', 'al furjan', 'discovery gardens', 'wasl gate',
        'sobha hartland', 'meydan one community', 'jumeirah golf estates', 'arabian ranches 3',
        'falcon city', 'tilal al ghaf', 'remraam', 'expo city')
    GROUP BY 1, 2 ORDER BY 1, transactions DESC
  `));
});
