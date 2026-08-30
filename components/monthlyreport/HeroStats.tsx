import { REPORT_COLORS as C } from "@/lib/reportTheme";

function fmtNum(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}

function fmtGrowth(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function Story({
  eyebrow,
  eyebrowColor,
  value,
  valueColor,
  sublabel,
  borderRight,
}: {
  eyebrow: string;
  eyebrowColor: string;
  value: string;
  valueColor: string;
  sublabel: React.ReactNode;
  borderRight: boolean;
}) {
  return (
    <div
      style={{
        padding: "28px 30px",
        borderRight: borderRight ? `1px solid ${C.borderLight}` : undefined,
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--font-dm-sans)",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: eyebrowColor,
          marginBottom: 14,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ font: "400 46px/.95 var(--font-dm-serif)", color: valueColor }}>{value}</div>
      <div style={{ font: "400 12.5px/1.5 var(--font-dm-sans)", color: C.textSecondary, marginTop: 9 }}>{sublabel}</div>
    </div>
  );
}

export function HeroStats({
  workDelivered,
  spanLabel,
  impressionsGrowthPct,
  impressionsBaseline,
  impressionsCurrent,
  clicksGrowthPct,
  clicksBaseline,
  clicksCurrent,
}: {
  workDelivered: number;
  spanLabel: string;
  impressionsGrowthPct: number | null;
  impressionsBaseline: number | null;
  impressionsCurrent: number | null;
  clicksGrowthPct: number | null;
  clicksBaseline: number | null;
  clicksCurrent: number | null;
}) {
  return (
    <div
      className="avoid-break"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${C.border}` }}
    >
      <Story
        eyebrow="Work delivered"
        eyebrowColor={C.midTeal}
        value={String(workDelivered)}
        valueColor={C.darkTeal}
        sublabel={
          <>
            Actions completed
            <br />
            across {spanLabel}
          </>
        }
        borderRight
      />
      <Story
        eyebrow="Growth"
        eyebrowColor={C.midTeal}
        value={fmtGrowth(impressionsGrowthPct)}
        valueColor={C.darkTeal}
        sublabel={
          <>
            Organic impressions
            <br />
            {fmtNum(impressionsBaseline)} → {fmtNum(impressionsCurrent)}
          </>
        }
        borderRight
      />
      <Story
        eyebrow="Organic clicks"
        eyebrowColor={C.orange}
        value={fmtGrowth(clicksGrowthPct)}
        valueColor={C.orange}
        sublabel={
          <>
            Organic clicks
            <br />
            {fmtNum(clicksBaseline)} → {fmtNum(clicksCurrent)}
          </>
        }
        borderRight={false}
      />
    </div>
  );
}
