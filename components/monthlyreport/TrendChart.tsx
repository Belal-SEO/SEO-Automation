import { REPORT_COLORS as C } from "@/lib/reportTheme";

export interface TrendPoint {
  label: string;
  impressions: number | null;
  clicks: number | null;
}

const XL = 50;
const XR = 720;
const Y_TOP = 21;
const Y_BOT = 165;

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <p style={{ font: "400 13px/1.5 var(--font-dm-sans)", color: C.muted }}>
        Not enough history yet to plot a trend — create at least one more report.
      </p>
    );
  }

  const n = points.length;
  const xFor = (i: number) => (n <= 1 ? XL : XL + ((XR - XL) * i) / (n - 1));
  const present = points
    .map((p, i) => ({ ...p, x: xFor(i) }))
    .filter((p): p is TrendPoint & { x: number } => p.impressions != null);
  const max = Math.max(...present.map((p) => p.impressions as number), 1) * 1.12;
  const yOf = (v: number) => Y_BOT - (v / max) * (Y_BOT - Y_TOP);
  const coords = present.map((p) => [p.x, yOf(p.impressions as number)] as const);
  const linePath = coords.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const areaPath = coords.length
    ? `${linePath} L${coords[coords.length - 1][0]},${Y_BOT} L${coords[0][0]},${Y_BOT} Z`
    : "";

  return (
    <svg viewBox="0 0 740 195" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="reportTrendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.midTeal} stopOpacity={0.22} />
          <stop offset="1" stopColor={C.midTeal} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1={XL} y1={165} x2={XR} y2={165} stroke={C.borderInput} />
      <line x1={XL} y1={117} x2={XR} y2={117} stroke="#f2f1ec" />
      <line x1={XL} y1={69} x2={XR} y2={69} stroke="#f2f1ec" />
      <line x1={XL} y1={21} x2={XR} y2={21} stroke="#f2f1ec" />
      {areaPath && <path d={areaPath} fill="url(#reportTrendArea)" />}
      {linePath && (
        <path d={linePath} fill="none" stroke={C.midTeal} strokeWidth={2.5} strokeLinejoin="round" />
      )}
      {present.map((p, i) => {
        const last = i === present.length - 1;
        return (
          <circle
            key={`${p.label}-${i}`}
            cx={p.x}
            cy={yOf(p.impressions as number)}
            r={last ? 5 : 4}
            fill={last ? C.orange : "#fff"}
            stroke={last ? C.orange : C.midTeal}
            strokeWidth={2.5}
          />
        );
      })}
      {points.map((p, i) => {
        const x = xFor(i);
        const isLast = i === n - 1;
        const hasData = p.impressions != null;
        return (
          <text
            key={`${p.label}-label-${i}`}
            x={x}
            y={186}
            fontFamily="var(--font-dm-sans)"
            fontSize={11}
            fill={isLast ? (hasData ? C.orange : "#c9c6c0") : C.muted}
            fontWeight={isLast && hasData ? 600 : 400}
            textAnchor={i === 0 ? "middle" : isLast ? "end" : "middle"}
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
