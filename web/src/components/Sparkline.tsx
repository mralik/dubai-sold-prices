export default function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 96;
  const height = 32;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => `${index * step},${height - (value / max) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="text-gulf-400">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
