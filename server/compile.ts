// Turns a checked query plan into parameterised SQL.
//
// Only fixed column names and placeholders ("?") are used. Values from the plan
// are passed as parameters, never pasted into the SQL text.

import type { SqlValue } from "./database";
import { addMonths, type QueryPlan } from "./plan";
import { communityAreas, communityProjects, communityValues } from "./communities";

/** The records table is deliberately small; statistics use every matching row. */
export const ROW_LIMIT = 25;

export interface CompiledQuery {
  sql: string;
  recordsSql: string;
  params: SqlValue[];
}

export function compilePlan(plan: QueryPlan): CompiledQuery {
  if (plan.status !== "ok") throw new Error("Only supported plans can be compiled.");

  const where: string[] = ["instance_date >= ?", "instance_date < ?"];
  // dateTo is inclusive, so the upper bound is the first day of the next month.
  const params: SqlValue[] = [`${plan.dateFrom}-01`, `${addMonths(plan.dateTo, 1)}-01`];

  const placeWhere: string[] = [];
  const placeParams: SqlValue[] = [];
  if (plan.areas.length > 0) {
    placeWhere.push(`area_name_en IN (${plan.areas.map(() => "?").join(", ")})`);
    placeParams.push(...plan.areas);
  }
  const masterProjects = communityValues(plan.communities);
  if (masterProjects.length > 0) {
    placeWhere.push(`master_project IN (${masterProjects.map(() => "?").join(", ")})`);
    placeParams.push(...masterProjects);
  }
  const projectNames = communityProjects(plan.communities);
  if (projectNames.length > 0) {
    placeWhere.push(`project_name IN (${projectNames.map(() => "?").join(", ")})`);
    placeParams.push(...projectNames);
  }
  if (placeWhere.length > 0) {
    where.push(`(${placeWhere.join(" OR ")})`);
    params.push(...placeParams);
    // On Cloudflare the table is stored sorted by area, so naming the areas a
    // community sits in lets the database read just those areas. The result
    // is the same: these are the only areas that hold the community's sales.
    const areasOfCommunities = plan.communities.length > 0 ? communityAreas(plan.communities) : null;
    if (areasOfCommunities) {
      const allAreas = [...new Set([...plan.areas, ...areasOfCommunities])];
      if (allAreas.length === 0) {
        where.push("0"); // the community has no sales in the data
      } else {
        where.push(`area_name_en IN (${allAreas.map(() => "?").join(", ")})`);
        params.push(...allAreas);
      }
    }
  }
  if (plan.propertyType !== "any") {
    where.push("property_type = ?");
    params.push(plan.propertyType);
  }
  if (plan.rooms !== "any") {
    where.push("rooms = ?");
    params.push(plan.rooms);
  }
  if (plan.registration !== "any") {
    where.push("registration = ?");
    params.push(plan.registration);
  }

  const baseSql = [
    "SELECT transaction_id, instance_date, area_name_en, master_project, project_name, property_type,",
    "       rooms, registration, size_sqft, price_aed, price_per_sqft",
    "FROM sales",
    `WHERE ${where.join("\n  AND ")}`,
  ].join("\n");
  const sql = baseSql;
  const recordsSql = `${baseSql}\nORDER BY instance_date DESC\nLIMIT ${ROW_LIMIT}`;

  return { sql, recordsSql, params };
}
