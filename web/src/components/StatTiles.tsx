import { BarChart3, Coins, Ruler, SlidersHorizontal } from "lucide-react";
import type { AskResult } from "../api";
import { aed, num } from "../format";

export function StatTiles({ result }: { result: AskResult }) {
  const s = result.summary!;
  const psf = result.plan.metric === "median_price_per_sqft";
  const middleHalf = psf
    ? s.psfP25 !== null && s.psfP75 !== null ? `AED ${num(s.psfP25)} – AED ${num(s.psfP75)} / sq ft` : "–"
    : s.priceP25 !== null && s.priceP75 !== null ? `${aed(s.priceP25)} – ${aed(s.priceP75)}` : "–";
  const tiles = [
    { icon: Coins, label: "Median price", value: aed(s.medianPrice), hint: "Half sold above, half below" },
    { icon: Ruler, label: "Median per sq ft", value: s.medianPricePerSqft ? `AED ${num(s.medianPricePerSqft)}` : "–", hint: "Price ÷ size" },
    { icon: BarChart3, label: "Sales", value: num(s.count), hint: "All matching transactions" },
    { icon: SlidersHorizontal, label: "Middle half", value: middleHalf, hint: "25th to 75th percentile" },
  ];
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value, hint }) => (
        <div key={label} className="card px-4 py-4 sm:px-5">
          <p className="flex items-center gap-2 text-xs font-medium text-ink-400">
            <Icon className="size-3.5 text-ink-500" aria-hidden />
            {label}
          </p>
          <p className="mt-2 font-display text-lg font-bold tracking-tight text-gold-200 tabular-nums sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-ink-500">{hint}</p>
        </div>
      ))}
    </section>
  );
}
