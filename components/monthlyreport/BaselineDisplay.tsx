import { REPORT_COLORS as C } from "@/lib/reportTheme";
import type { Baseline } from "@/lib/monthlyReportTypes";

function BaselineCard({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div style={{ border: `1px solid ${C.borderCard}`, borderRadius: 10, padding: "14px 15px" }}>
      <div
        style={{
          font: "600 9.5px/1.35 var(--font-dm-sans)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: C.muted,
          marginBottom: 8,
          minHeight: 26,
        }}
      >
        {label}
      </div>
      <div style={{ font: "600 21px/1 var(--font-dm-sans)", color: C.darkTeal }}>{value.toLocaleString("en-US")}</div>
      <div style={{ font: "400 10.5px/1.3 var(--font-dm-sans)", color: C.mutedLight, marginTop: 7 }}>{sublabel}</div>
    </div>
  );
}

export function BaselineDisplay({ baseline }: { baseline: Baseline }) {
  return (
    <div className="avoid-break" style={{ padding: "26px 44px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <span
          style={{
            font: "700 10px/1 var(--font-dm-sans)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: C.textSecondary,
            background: C.pillBg,
            padding: "5px 11px",
            borderRadius: 100,
          }}
        >
          Baseline
        </span>
        <span style={{ font: "400 17px/1 var(--font-dm-serif)", color: C.text }}>Starting point</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <BaselineCard label="Organic Impressions" value={baseline.organicImpressions} sublabel="GSC — last 3 months" />
        <BaselineCard label="Organic Clicks" value={baseline.organicClicks} sublabel="GSC — last 3 months" />
        <BaselineCard label="Indexed Pages" value={baseline.indexedPages} sublabel="Search Console" />
        <BaselineCard label="Total Backlinks" value={baseline.totalBacklinks} sublabel="All time" />
      </div>
    </div>
  );
}
