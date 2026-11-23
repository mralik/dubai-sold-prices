export const aed = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return "–";
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`;
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
};

export const num = (n: number | null | undefined): string => (n === null || n === undefined ? "–" : Math.round(n).toLocaleString("en-US"));

export const monthShort = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export const monthLong = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};

export const dateShort = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const roomsLabel = (r: string): string => (r === "unknown" ? "–" : r === "studio" ? "Studio" : `${r} bed`);
