// Source credit required by the data.dubai Open Data License:
// name the originator, link to the original data (clause 3.2.1), and don't
// suggest the app is linked to DLD or the Dubai Government (clause 3.2.2).

export const DLD_SOURCE_LINE = "Source: Dubai Land Department, via data.dubai (Open Data License)";
export const DLD_SOURCE_URL = "https://data.dubai/en/l/470061";
export const DLD_SOURCE_URL_SHORT = "data.dubai/en/l/470061";
export const NOT_AFFILIATED_LINE = "Not affiliated with or endorsed by Dubai Land Department.";

/** True when the figures come from the real DLD data, not the synthetic sample. */
export const isDldData = (attribution: string | null | undefined): boolean =>
  Boolean(attribution?.startsWith("Source: Dubai Land Department"));

/** Plain-text credit lines, for places that can't hold a link (images, WhatsApp). */
export function sourceTextLines(attribution: string | null | undefined): string[] {
  if (isDldData(attribution)) return [DLD_SOURCE_LINE, DLD_SOURCE_URL, NOT_AFFILIATED_LINE];
  return attribution ? [attribution] : [];
}
