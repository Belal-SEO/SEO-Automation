"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SourceBadge } from "@/components/monthlyreport/SourceBadge";
import { computeGrowthPct } from "@/lib/monthlyReportDerive";
import type { Database } from "@/lib/supabase/database.types";
import type { MonthlyReportMetric } from "@/lib/monthlyReportTypes";

type MetricUpdate = Database["public"]["Tables"]["monthly_report_metrics"]["Update"];

export function MetricRow({
  metric,
  baselineValue,
}: {
  metric: MonthlyReportMetric;
  baselineValue: number | null;
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{metric.label}</p>
        {metric.sublabel && <p className="text-xs text-muted-foreground">{metric.sublabel}</p>}
      </div>
      <div className="flex items-center gap-3">
        <SourceBadge source={metric.source} isOverridden={metric.isOverridden} fetchedAt={metric.fetchedAt} />
        {growth != null && (
          <span className={growth >= 0 ? "text-xs font-medium text-emerald-600" : "text-xs font-medium text-red-600"}>
            {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}%
          </span>
        )}
        {isYesNo ? (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            disabled={saving}
            className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">—</option>
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
            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-right text-sm"
          />
        )}
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
