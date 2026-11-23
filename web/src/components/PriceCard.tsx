import type { CSSProperties } from "react";
import type { AreaSummary } from "../../../server/aggregate";
import { LOW_SAMPLE_WARNING } from "../../../server/thresholds";
import type { AskResult } from "../api";
import { aed, num } from "../format";
import { APP_NAME, CARD_COLORS, cardFilters, cardPeriod, cardPlaceName, cardPlaces, cardSourceLines, comparisonCallout, showLowSample, trendSeries, type CardColors } from "../shareCard";
import { Skyline } from "./Skyline";

export type CardVariant = "square" | "story";

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M32 8l5.2 14.8L52 28l-14.8 5.2L32 48l-5.2-14.8L12 28l14.8-5.2z" fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function Trend({ series, colors, height, labels }: { series: { key: string; values: (number | null)[] }[]; colors: CardColors; height: number; labels: string[] }) {
  const width = 920;
  const palette = [colors.gold, colors.gulf];
  const flat = series.flatMap((item) => item.values.filter((value): value is number => value !== null));
  if (flat.length < 2) return null;
  const legend = series.map((item, index) => item.key === "value" ? "" : (labels[index] ?? item.key)).filter(Boolean);
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const span = max - min || 1;
  return (
    <div>
      {legend.length > 1 && (
        <div style={{ display: "flex", gap: 20, marginBottom: 8 }}>
          {legend.map((name, index) => (
            <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: palette[index % palette.length], fontSize: 18, fontWeight: 700 }}>{name}</span>
          ))}
        </div>
      )}
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend over the selected months">
      {series.map((item, seriesIndex) => {
        const parts: string[][] = [];
        let current: string[] = [];
        item.values.forEach((value, index) => {
          if (value === null) {
            if (current.length) parts.push(current);
            current = [];
            return;
          }
          const x = item.values.length === 1 ? width / 2 : (index / (item.values.length - 1)) * (width - 8) + 4;
          const y = height - 16 - ((value - min) / span) * (height - 28);
          current.push(`${x},${y}`);
        });
        if (current.length) parts.push(current);
        const color = palette[seriesIndex % palette.length]!;
        return (
          <g key={item.key}>
            {parts.filter((part) => part.length >= 2).map((part) => (
              <polyline key={part.join("|")} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" points={part.join(" ")} />
            ))}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

function Stat({ label, value, colors, align = "left" }: { label: string; value: string; colors: CardColors; align?: "left" | "right" }) {
  return (
    <div style={{ textAlign: align }}>
      <p style={{ margin: 0, fontSize: 18, letterSpacing: "0.16em", textTransform: "uppercase", color: colors.muted }}>{label}</p>
      <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700, color: colors.ink, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>{value}</p>
    </div>
  );
}

function middleHalf(area: Pick<AreaSummary, "priceP25" | "priceP75" | "psfP25" | "psfP75">, metric: AskResult["plan"]["metric"]): string {
  if (metric === "median_price_per_sqft") {
    if (area.psfP25 === null || area.psfP75 === null) return "–";
    return `AED ${num(area.psfP25)} – AED ${num(area.psfP75)} / sq ft`;
  }
  if (area.priceP25 === null || area.priceP75 === null) return "–";
  return `${aed(area.priceP25)} – ${aed(area.priceP75)}`;
}

function PlaceColumn({ area, colors, metric }: { area: AreaSummary; colors: CardColors; metric: AskResult["plan"]["metric"] }) {
  const psf = metric === "median_price_per_sqft";
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 40, fontWeight: 800, lineHeight: 1.05, color: colors.ink, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>{cardPlaceName(area.area)}</p>
      <p data-median-price={psf ? area.medianPricePerSqft ?? "" : area.medianPrice ?? ""} style={{ margin: "18px 0 0", fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", color: colors.ink, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>{psf ? `AED ${num(area.medianPricePerSqft)} / sq ft` : aed(area.medianPrice)}</p>
      <p style={{ margin: "16px 0 0", fontSize: 15, letterSpacing: "0.14em", textTransform: "uppercase", color: colors.muted }}>Middle half</p>
      <p style={{ margin: "4px 0 0", fontSize: 20, color: colors.ink, whiteSpace: "nowrap" }}>{middleHalf(area, metric)}</p>
      <p data-sales-count={area.count} style={{ margin: "6px 0 0", fontSize: 20, color: colors.soft }}>{num(area.count)} sales</p>
    </div>
  );
}

export function PriceCard({ result, variant, colors = CARD_COLORS.light }: { result: AskResult; variant: CardVariant; colors?: CardColors }) {
  const story = variant === "story";
  const height = story ? 1920 : 1080;
  const summary = result.summary;
  const places = cardPlaces(result);
  const comparing = result.areas.length === 2;
  const callout = comparing ? comparisonCallout(result) : null;
  const series = trendSeries(result);
  const sources = cardSourceLines(result);
  const placeSize = Math.min(story ? 104 : 84, places.join(" ").length > 28 ? 56 : 92);
  const shell: CSSProperties = {
    width: 1080,
    height,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    background: colors.bg,
    color: colors.ink,
    fontFamily: "Inter, sans-serif",
  };

  return (
    <article style={shell} data-card-variant={variant} aria-label="Shareable price card">
      <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(700px 420px at 100% 0%, ${colors.gold}22, transparent 60%), radial-gradient(640px 420px at 0% 80%, ${colors.gulf}1f, transparent 62%)` }} />
      <div aria-hidden style={{ position: "absolute", top: story ? 80 : 36, right: 48, opacity: 0.22 }}><Star size={story ? 220 : 160} color={colors.gold} /></div>
      <div aria-hidden style={{ position: "absolute", bottom: story ? 280 : 210, left: 36, opacity: 0.1 }}><Star size={72} color={colors.gulf} /></div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflow: "hidden", padding: story ? "96px 76px 0" : "64px 76px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 12, fontSize: 20, letterSpacing: "0.2em", fontWeight: 700, color: colors.gold }}>
            <Star size={22} color={colors.gold} />
            {APP_NAME.toUpperCase()}
          </p>
          <p style={{ margin: 0, fontSize: 26, color: colors.muted }}>{cardPeriod(result)}</p>
        </div>

        <h1 style={{ margin: story ? "72px 0 0" : "40px 0 0", maxWidth: 900, fontSize: placeSize, lineHeight: 0.98, fontWeight: 800, letterSpacing: "-0.035em", fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>
          {places.join("  ·  ")}
        </h1>
        <p style={{ margin: "18px 0 0", fontSize: 28, color: colors.gulf }}>{cardFilters(result)}</p>
        <div style={{ marginTop: story ? 48 : 32, height: 1, background: colors.line }} />

        {comparing ? (
          <div style={{ marginTop: story ? 64 : 36 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 28, alignItems: "center" }}>
              <PlaceColumn area={result.areas[0]!} colors={colors} metric={result.plan.metric} />
              <div style={{ textAlign: "center", minWidth: 180 }}>
                <p style={{ margin: 0, fontSize: 18, letterSpacing: "0.16em", textTransform: "uppercase", color: colors.muted }}>Difference</p>
                <p style={{ margin: "8px 0 0", fontSize: 72, fontWeight: 800, letterSpacing: "-0.04em", color: colors.gold, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>{callout?.pctLabel || "–"}</p>
              </div>
              <PlaceColumn area={result.areas[1]!} colors={colors} metric={result.plan.metric} />
            </div>
            {callout && <p style={{ margin: "28px 0 0", fontSize: 26, lineHeight: 1.35, color: colors.soft }}>{callout.sentence}</p>}
          </div>
        ) : (
          <div style={{ marginTop: story ? 72 : 36 }}>
            <p style={{ margin: 0, fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase", color: colors.gold }}>{result.plan.metric === "median_price_per_sqft" ? "Median price per sq ft" : "Median sale price"}</p>
            <p data-median-price={result.plan.metric === "median_price_per_sqft" ? summary?.medianPricePerSqft ?? "" : summary?.medianPrice ?? ""} style={{ margin: "12px 0 0", fontSize: story ? 148 : 112, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.95, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>{result.plan.metric === "median_price_per_sqft" ? `AED ${num(summary?.medianPricePerSqft)} / sq ft` : aed(summary?.medianPrice)}</p>
            <div style={{ marginTop: story ? 56 : 36, display: "flex", justifyContent: "space-between", gap: 32 }}>
              <Stat label="Middle half" value={summary ? middleHalf(summary, result.plan.metric) : "–"} colors={colors} />
              <Stat label="Sales" value={num(summary?.count)} colors={colors} align="right" />
            </div>
            {summary && <span data-sales-count={summary.count} style={{ display: "none" }}>{num(summary.count)}</span>}
            {result.registrationSplit && (
              <div style={{ marginTop: story ? 36 : 28 }}>
                <p data-split-line="off-plan" style={{ margin: 0, fontSize: 28, lineHeight: 1.35, color: colors.ink }}>{result.registrationSplit.offPlan.line}</p>
                <p data-split-line="ready" style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.35, color: colors.ink }}>{result.registrationSplit.ready.line}</p>
              </div>
            )}
          </div>
        )}

        {/* A square comparison card has no room left for the chart, so only the story card shows it. */}
        {series.length > 0 && (story || !comparing) && (
          <div style={{ marginTop: story ? 64 : 28 }}>
            <Trend series={series} colors={colors} height={story ? 220 : 108} labels={places} />
          </div>
        )}

        {showLowSample(result) && (
          <p style={{ margin: story ? "36px 0 0" : "20px 0 0", padding: "14px 18px", borderRadius: 16, background: colors.noteBg, color: colors.soft, fontSize: 22, lineHeight: 1.35 }}>{LOW_SAMPLE_WARNING}</p>
        )}
      </div>

      <div aria-hidden style={{ position: "relative", zIndex: 1, flexShrink: 0, height: story ? 220 : 132, marginTop: -8, opacity: 0.55 }}>
        <Skyline idPrefix={`card-${variant}`} style={{ width: "100%", height: "100%" }} colors={{ top: colors.skyTop, bottom: colors.skyBottom, edge: colors.skyEdge, light: colors.skyLight, glow: colors.skyGlow }} />
      </div>

      <footer style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "22px 76px 28px", background: colors.bgDeep }}>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}>{APP_NAME}</p>
        {sources.map((line) => (
          <p key={line} data-source-line="" style={{ margin: "10px 0 0", fontSize: 20, lineHeight: 1.4, color: colors.soft }}>{line}</p>
        ))}
      </footer>
    </article>
  );
}
