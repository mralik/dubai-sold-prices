import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineIcon } from "lucide-react";
import type { AskResult } from "../api";
import { aed, monthShort, num } from "../format";
import { useTheme } from "../theme";

// Chart colours per theme (SVG attributes can't read CSS variables reliably).
const PALETTE = {
  dark: { gold: "#b89452", teal: "#3fd3bd", axis: "#8e99b3", grid: "rgba(255,255,255,0.07)", tipBg: "#0b1120", tipText: "#eef1f7", tipLabel: "#cbb47b", legend: "#b7c0d4" },
  light: { gold: "#8d6b35", teal: "#0e8c7f", axis: "#5b6479", grid: "rgba(42,34,20,0.08)", tipBg: "#ffffff", tipText: "#121827", tipLabel: "#76551f", legend: "#3b4459" },
};

export function TrendChart({ result, printMode = false }: { result: AskResult; printMode?: boolean }) {
  const { theme } = useTheme();
  const c = PALETTE[printMode ? "light" : theme];
  const GOLD = c.gold;
  const COLORS = [c.gold, c.teal];
  const AXIS = { fontSize: 12, fill: c.axis };
  const { plan, series, seriesKeys } = result;
  const metric = plan.metric;
  const title =
    metric === "count" ? "Number of sales by month" : metric === "median_price_per_sqft" ? "Median price per sq ft by month" : "Median sale price by month";
  const format = (v: number) => (metric === "count" ? num(v) : metric === "median_price_per_sqft" ? `AED ${num(v)}` : aed(v));
  const axisFormat = (v: number) => (metric === "count" ? num(v) : metric === "median_price_per_sqft" ? num(v) : aed(v).replace("AED ", ""));
  const label = (k: string) => (k === "value" ? (metric === "count" ? "Sales" : "Median") : k);
  const data = series.map((p) => ({ ...p, label: monthShort(String(p.month)) }));
  const hasData = series.some((p) => seriesKeys.some((k) => typeof p[k] === "number"));
  if (!hasData || series.length < 2) return null;

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={c.grid} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} minTickGap={18} />
      <YAxis tickLine={false} axisLine={false} width={64} tick={AXIS} tickFormatter={axisFormat} domain={metric === "count" ? [0, "auto"] : ["auto", "auto"]} />
      <Tooltip
        formatter={(v, name) => [typeof v === "number" ? format(v) : "No sales", label(String(name))]}
        contentStyle={{ background: c.tipBg, borderRadius: 12, border: "1px solid rgba(201,151,60,0.35)", color: c.tipText, fontSize: 13, boxShadow: "0 10px 30px -12px rgba(0,0,0,0.35)" }}
        labelStyle={{ color: c.tipLabel, fontWeight: 600 }}
        cursor={metric === "count" ? { fill: "rgba(201,151,60,0.08)" } : { stroke: "rgba(201,151,60,0.45)" }}
      />
      {seriesKeys.length > 1 && <Legend formatter={(v) => <span style={{ color: c.legend }}>{label(String(v))}</span>} wrapperStyle={{ fontSize: 13 }} />}
    </>
  );

  return (
    <section className="card px-3 pt-5 pb-3 sm:px-6" aria-labelledby="chart-heading">
      <div className="px-2">
        <h2 id="chart-heading" className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          <LineIcon className="size-4 text-ink-500" aria-hidden />
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-ink-500">Gaps mean no matching sales that month.</p>
      </div>
      <div className="mt-4 h-72 w-full" role="img" aria-label={`${title}, ${series.length} months`}>
        <ResponsiveContainer width="100%" height="100%">
          {metric === "count" ? (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {COLORS.map((c, i) => (
                  <linearGradient key={c} id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.35} />
                  </linearGradient>
                ))}
              </defs>
              {axes}
              {seriesKeys.map((k, i) => <Bar key={k} dataKey={k} fill={`url(#bar-${i % 2})`} radius={[6, 6, 0, 0]} maxBarSize={26} />)}
            </BarChart>
          ) : seriesKeys.length > 1 ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {axes}
              {seriesKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % 2]} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls={false} />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="area-gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              {axes}
              <Area type="monotone" dataKey="value" stroke={GOLD} strokeWidth={2.5} fill="url(#area-gold)" dot={series.length <= 12 ? { r: 3, fill: GOLD, strokeWidth: 0 } : false} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
