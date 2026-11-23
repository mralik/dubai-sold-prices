/**
 * Column names in the public DLD transactions CSV from data.dubai.
 * `npm run data:inspect` lists the columns of a new export, and the importer
 * stops if any of these are missing, so a format change can't slip through.
 */
export const DLD_MAPPING = {
  transactionId: "transaction_id",
  date: "instance_date",
  transactionGroup: "trans_group_en",
  procedure: "procedure_name_en",
  usage: "property_usage_en",
  propertyType: "property_type_en",
  propertySubType: "property_sub_type_en",
  rooms: "rooms_en",
  area: "area_name_en",
  project: "project_name_en",
  masterProject: "master_project_en",
  registration: "reg_type_en",
  sizeSqm: "procedure_area",
  priceAed: "actual_worth",
} as const;

export const REQUIRED_DLD_COLUMNS = Object.values(DLD_MAPPING);

