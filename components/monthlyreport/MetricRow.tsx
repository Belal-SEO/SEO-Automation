"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SourceBadge } from "@/components/monthlyreport/SourceBadge";
import { computeGrowthPct } from "@/lib/monthlyReportDerive";
import { REPORT_COLORS as C } from "@/lib/reportTheme";
import type { Database } from "@/lib/supabase/database.types";
import type { MonthlyReportMetric } from "@/lib/monthlyReportTypes";

type MetricUpdate = Database["public"]["Tables"]["monthly_report_metrics"]["Update"];

export function MetricRow({
  metric,
  baselineValue,
  accent,
}: {
  metric: MonthlyReportMetric;
  baselineValue: number | null;
  accent: string;
}) {
  const router = useRouter();
  const isYesNo = metric.key === "gbp_optimised";
  const [value, setValue] = useState(isYesNo ? (metric.valueText ?? "") : (metric.valueNumber?.toString() ?? ""));
  const [saving, setSaving] = useState(false);

  const growth = !isYesNo && baselineValue != null ? computeGrowthPct(metric.valueNumber, baselineValue) : null;

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const patch: MetricUpdate = isYesNo
      ? { value_text: value || null }
      : { value_number: value === "" ? null : Number(value) };
    if (metric.source !== "manual") patch.is_overridden = true;
    await supabase.from("monthly_report_metrics").update(patch).eq("id", metric.id);
    setSaving(false);
    router.refresh();
  }

  async function handleRevert() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("monthly_report_metrics")
      .update({ value_number: metric.autoValue, is_overridden: false })
      .eq("id", metric.id);
    setSaving(false);
    router.refresh();
  }

  const up = growth != null && growth >= 0;
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    color: accent,
    background: C.subtleBg,
    border: `1px solid ${C.borderInput}`,
    borderRadius: 7,
    outline: "none",
  };

  return (
    <div style={{ border: `1px solid ${C.borderCard}`, borderRadius: 10, padding: "14px 15px", position: "relative" }}>
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
        {metric.label}
      </div>
      {isYesNo ? (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          disabled={saving}
          style={{ ...fieldStyle, font: "600 15px/1 var(--font-dm-sans)", padding: "8px 9px", cursor: "pointer" }}
        >
          <option value="">— Select —</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : (
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          disabled={saving}
          placeholder="0"
          style={{ ...fieldStyle, font: "600 21px/1 var(--font-dm-sans)", padding: "6px 9px" }}
        />
      )}
      <div style={{ font: "400 10.5px/1.3 var(--font-dm-sans)", color: C.mutedLight, marginTop: 7 }}>{metric.sublabel}</div>
      {growth != null && (
        <span
          style={{
            display: "inline-block",
            marginTop: 7,
            font: "700 10.5px/1 var(--font-dm-sans)",
            color: up ? C.badgeGreenText : C.badgeRedText,
            background: up ? C.badgeGreenBg : C.badgeRedBg,
            padding: "4px 8px",
            borderRadius: 100,
          }}
        >
          {up ? "▲ +" : "▼ "}
          {Math.abs(growth).toFixed(0)}%
        </span>
      )}
      <div className="print:hidden flex flex-wrap items-center gap-2" style={{ marginTop: 8 }}>
        <SourceBadge source={metric.source} isOverridden={metric.isOverridden} fetchedAt={metric.fetchedAt} />
        {metric.isOverridden && metric.autoValue != null && (
          <button
            type="button"
            onClick={handleRevert}
            disabled={saving}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Revert to {metric.autoValue}
          </button>
        )}
      </div>
    </div>
  );
}
