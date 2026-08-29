import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapClient } from "@/lib/queries";
import {
  mapBaseline,
  mapMonthlyReport,
  mapMonthlyReportMetric,
  mapMonthlyReportTask,
} from "@/lib/monthlyReportQueries";
import { computeGrowthPct, computeWorkDeliveredTotal } from "@/lib/monthlyReportDerive";
import { METRIC_LABELS, TASK_LIST_LABELS, type MonthlyMetricKey, type MonthlyTaskListKey } from "@/lib/monthlyReportTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroStats } from "@/components/monthlyreport/HeroStats";
import { TrendChart, type TrendPoint } from "@/components/monthlyreport/TrendChart";
import { MetricRow } from "@/components/monthlyreport/MetricRow";
import { DetailList } from "@/components/monthlyreport/DetailList";
import { RefreshButton } from "@/components/monthlyreport/RefreshButton";
import { PrintButton } from "@/components/monthlyreport/PrintButton";
import { StatusControl } from "@/components/monthlyreport/StatusControl";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BASELINE_KEY_MAP: Partial<Record<MonthlyMetricKey, keyof ReturnType<typeof mapBaseline>>> = {
  impressions: "organicImpressions",
  clicks: "organicClicks",
  pages_indexed: "indexedPages",
  backlinks_built: "totalBacklinks",
};

export default async function MonthlyReportEditorPage({
  params,
}: {
  params: { clientId: string; reportId: string };
}) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();

  const [{ data: clientRow }, { data: reportRow }, { data: baselineRow }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase
      .from("monthly_reports")
      .select("*")
      .eq("id", params.reportId)
      .eq("client_id", params.clientId)
      .maybeSingle(),
    supabase.from("baselines").select("*").eq("client_id", params.clientId).maybeSingle(),
  ]);

  if (!clientRow || !reportRow) notFound();
  const client = mapClient(clientRow);
  const report = mapMonthlyReport(reportRow);
  const baseline = baselineRow ? mapBaseline(baselineRow) : null;

  const [{ data: metricRows }, { data: taskRows }, { data: allReportRows }] = await Promise.all([
    supabase.from("monthly_report_metrics").select("*").eq("monthly_report_id", report.id),
    supabase.from("monthly_report_tasks").select("*").eq("monthly_report_id", report.id).order("sort_index"),
    supabase
      .from("monthly_reports")
      .select("id, period_label, period_start")
      .eq("client_id", client.id)
      .order("period_start", { ascending: true }),
  ]);

  const metrics = (metricRows ?? []).map(mapMonthlyReportMetric);
  const tasks = (taskRows ?? []).map(mapMonthlyReportTask);
  const metricByKey = new Map(metrics.map((m) => [m.key, m]));

  const otherReportIds = (allReportRows ?? []).map((r) => r.id);
  const { data: trendMetricRows } =
    otherReportIds.length > 0
      ? await supabase
          .from("monthly_report_metrics")
          .select("monthly_report_id, key, value_number")
          .in("monthly_report_id", otherReportIds)
          .in("key", ["impressions", "clicks"])
      : { data: [] as never[] };

  const trendPoints: TrendPoint[] = [];
  if (baseline) {
    trendPoints.push({ label: "Baseline", impressions: baseline.organicImpressions, clicks: baseline.organicClicks });
  }
  for (const r of allReportRows ?? []) {
    const impressions = trendMetricRows?.find((m) => m.monthly_report_id === r.id && m.key === "impressions")?.value_number ?? null;
    const clicks = trendMetricRows?.find((m) => m.monthly_report_id === r.id && m.key === "clicks")?.value_number ?? null;
    trendPoints.push({ label: r.period_label, impressions, clicks });
  }

  const workDelivered = computeWorkDeliveredTotal(tasks);
  const impressionsGrowth = baseline
    ? computeGrowthPct(metricByKey.get("impressions")?.valueNumber ?? null, baseline.organicImpressions)
    : null;
  const clicksGrowth = baseline
    ? computeGrowthPct(metricByKey.get("clicks")?.valueNumber ?? null, baseline.organicClicks)
    : null;

  const metricKeys = Object.keys(METRIC_LABELS) as MonthlyMetricKey[];
  const listKeys = Object.keys(TASK_LIST_LABELS) as MonthlyTaskListKey[];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {client.brand} — {report.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {report.periodLabel} · {formatDate(report.periodStart)} – {formatDate(report.periodEnd)} · scheduled to
            send {formatDate(report.scheduledSendDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusControl reportId={report.id} status={report.status} />
          <RefreshButton reportId={report.id} />
          <PrintButton />
        </div>
      </div>

      {!baseline && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          No baseline set for this client — growth percentages won&apos;t show until one is saved on the Monthly
          Reports settings page.
        </p>
      )}

      <HeroStats workDelivered={workDelivered} impressionsGrowth={impressionsGrowth} clicksGrowth={clicksGrowth} />

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart points={trendPoints} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metrics</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {metricKeys.map((key) => {
            const metric = metricByKey.get(key);
            if (!metric) return null;
            const baselineField = BASELINE_KEY_MAP[key];
            const baselineValue = baseline && baselineField ? (baseline[baselineField] as number) : null;
            return <MetricRow key={key} metric={metric} baselineValue={baselineValue} />;
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {listKeys.map((listKey) => (
          <Card key={listKey}>
            <CardHeader>
              <CardTitle>{TASK_LIST_LABELS[listKey]}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList reportId={report.id} listKey={listKey} tasks={tasks.filter((t) => t.listKey === listKey)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
