import type { CSSProperties } from "react";

// A stylised Dubai skyline: Dubai Frame, Museum of the Future, Emirates Towers,
// Burj Khalifa, Cayan Tower and Burj Al Arab, with lit windows.

const TOWERS: [number, number, number][] = [
  // x, width, height
  [20, 46, 70], [72, 30, 96], [108, 52, 58], [168, 26, 118], [300, 40, 84], [346, 30, 126], [500, 34, 104],
  [612, 44, 92], [662, 26, 132], [770, 40, 120], [816, 28, 150], [850, 50, 86], [906, 30, 110],
  [1010, 46, 96], [1062, 32, 130], [1210, 40, 90], [1256, 30, 118], [1292, 56, 72], [1356, 34, 100], [1396, 44, 64],
];

function windows(): [number, number][] {
  const out: [number, number][] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const [x, w, h] of TOWERS) {
    for (let y = 220 - h + 8; y < 214; y += 9) {
      for (let wx = x + 5; wx < x + w - 5; wx += 8) if (rand() > 0.72) out.push([wx, y]);
    }
  }
  return out;
}
const LIGHTS = windows();

export function Skyline({ className = "", idPrefix = "sky", colors, style }: { className?: string; idPrefix?: string; colors?: { top: string; bottom: string; edge: string; light: string; glow: string }; style?: CSSProperties }) {
  const fill = `${idPrefix}-fill`;
  const edge = `${idPrefix}-edge`;
  const glow = `${idPrefix}-glow`;
  const top = colors?.top ?? "var(--sky-top)";
  const bottom = colors?.bottom ?? "var(--sky-bottom)";
  const edgeColor = colors?.edge ?? "var(--sky-edge)";
  const light = colors?.light ?? "var(--sky-light)";
  const glowColor = colors?.glow ?? "var(--sky-glow)";
  return (
    <svg viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={edge} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={edgeColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={edgeColor} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="720" cy="70" r="120" fill={`url(#${glow})`} />

      <g fill={`url(#${fill})`} stroke={`url(#${edge})`} strokeWidth="1">
        {TOWERS.map(([x, w, h]) => <rect key={x} x={x} y={220 - h} width={w} height={h} rx="1.5" />)}
        {/* Dubai Frame */}
        <path fillRule="evenodd" d="M222 220V96h66v124zM234 220V110h42v110z" />
        {/* Museum of the Future */}
        <path fillRule="evenodd" d="M398 220v-22c-14-8-22-24-22-40 0-26 24-46 54-46s54 20 54 46c0 16-8 32-22 40v22zM414 158c0 12 8 20 16 20s20-6 22-18c2-12-8-24-20-24s-18 10-18 22z" />
        {/* Emirates Towers */}
        <path d="M552 220V112l14-26 14 26v108zM586 220V128l11-20 11 20v92z" />
        {/* Burj Khalifa */}
        <path d="M694 220v-60h6v-34h6v-40h5v-38h4v-26l3-22 3 22v26h4v38h5v40h6v34h6v60z" />
        {/* Cayan Tower */}
        <path d="M960 220V72c8-6 18-6 26 0v148z" />
        {/* Burj Al Arab */}
        <path d="M1126 220V70l6-12 6 12c34 22 50 74 52 150z" />
      </g>
      <path d="M1132 58v-18" stroke={edgeColor} strokeOpacity="0.6" strokeWidth="1.5" />

      <g fill={light}>
        {LIGHTS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="2.5" height="3" opacity={0.25 + ((x * y) % 7) / 12} />)}
      </g>
      <rect x="0" y="219" width="1440" height="1" fill={edgeColor} opacity="0.35" />
    </svg>
  );
}
