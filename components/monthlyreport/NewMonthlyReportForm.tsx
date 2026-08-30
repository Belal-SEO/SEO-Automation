"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { computeScheduledSendDate } from "@/lib/monthlyReportDerive";
import { METRIC_LABELS, type MetricSource, type MonthlyMetricKey } from "@/lib/monthlyReportTypes";

export function NewMonthlyReportForm({
  clientId,
  sendDayOfMonth,
  gscConfigured,
  sheetConfigured,
  gbpConfigured,
}: {
  clientId: string;
  sendDayOfMonth: number;
  gscConfigured: boolean;
  sheetConfigured: boolean;
  gbpConfigured: boolean;
}) {
  const router = useRouter();
  const today = new Date();
  const [periodLabel, setPeriodLabel] = useState(
    today.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  );
  const [periodStart, setPeriodStart] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10),
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceForKey = (key: MonthlyMetricKey): MetricSource => {
    if ((key === "impressions" || key === "clicks") && gscConfigured) return "gsc";
    if (key === "backlinks_built" && sheetConfigured) return "sheet";
    if (key === "gbp_posts" && gbpConfigured) return "gbp";
    return "manual";
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const supabase = createClient();

    const { data: report, error: insertError } = await supabase
      .from("monthly_reports")
      .insert({
        client_id: clientId,
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        scheduled_send_date: computeScheduledSendDate(periodEnd, sendDayOfMonth),
      })
      .select("id")
      .single();

    if (insertError || !report) {
      setError(insertError?.message ?? "Failed to create report.");
      setCreating(false);
      return;
    }

    const metricKeys = Object.keys(METRIC_LABELS) as MonthlyMetricKey[];
    await supabase.from("monthly_report_metrics").insert(
      metricKeys.map((key) => ({
        monthly_report_id: report.id,
        key,
        label: METRIC_LABELS[key].label,
        sublabel: METRIC_LABELS[key].sublabel,
        source: sourceForKey(key),
      })),
    );

    if (gscConfigured || sheetConfigured || gbpConfigured) {
      await fetch(`/api/monthly-reports/${report.id}/refresh`, { method: "POST" }).catch(() => {});
    }

    router.push(`/clients/${clientId}/monthly-reports/${report.id}`);
  }

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Period label</label>
          <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Start date</label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">End date</label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={creating}>
        {creating ? "Creating…" : "Create report"}
      </Button>
    </form>
  );
}
