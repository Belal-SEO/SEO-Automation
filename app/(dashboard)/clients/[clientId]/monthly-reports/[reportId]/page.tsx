import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapClient } from "@/lib/queries";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import {
  mapBaseline,
  mapMonthlyReport,
  mapMonthlyReportEmailDraft,
  mapMonthlyReportMetric,
  mapMonthlyReportSettings,
  mapMonthlyReportTask,
} from "@/lib/monthlyReportQueries";
import { computeGrowthPct, computeWorkDeliveredTotal, countByListKey } from "@/lib/monthlyReportDerive";
import { METRIC_LABELS, TASK_LIST_LABELS, type MonthlyMetricKey, type MonthlyTaskListKey } from "@/lib/monthlyReportTypes";
import { dmSans, dmSerifDisplay } from "@/lib/reportFonts";
import { REPORT_COLORS as C, accentBgFor } from "@/lib/reportTheme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HeroStats } from "@/components/monthlyreport/HeroStats";
import { TrendChart, type TrendPoint } from "@/components/monthlyreport/TrendChart";
import { WorkStrip } from "@/components/monthlyreport/WorkStrip";
import { BaselineDisplay } from "@/components/monthlyreport/BaselineDisplay";
import { MetricRow } from "@/components/monthlyreport/MetricRow";
import { DetailList } from "@/components/monthlyreport/DetailList";
import { NotesBlock } from "@/components/monthlyreport/NotesBlock";
import { RefreshButton } from "@/components/monthlyreport/RefreshButton";
import { PrintButton } from "@/components/monthlyreport/PrintButton";
import { StatusControl } from "@/components/monthlyreport/StatusControl";
import { DraftEmailPanel } from "@/components/monthlyreport/DraftEmailPanel";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BASELINE_KEY_MAP: Partial<Record<MonthlyMetricKey, keyof ReturnType<typeof mapBaseline>>> = {
  impressions: "organicImpressions",
  clicks: "organicClicks",
  pages_indexed: "indexedPages",
  backlinks_built: "totalBacklinks",
};

const DETAIL_LIST_KEYS: MonthlyTaskListKey[] = ["issues", "pages_optimised", "new_pages", "backlinks", "blog_posts", "cro"];

export default async function MonthlyReportEditorPage({
  params,
}: {
  params: { clientId: string; reportId: string };
}) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const role = await getCurrentTeamRole(supabase);
  if (role !== "admin") redirect("/clients");

  const [{ data: clientRow }, { data: reportRow }, { data: baselineRow }, { data: settingsRow }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase
      .from("monthly_reports")
      .select("*")
      .eq("id", params.reportId)
      .eq("client_id", params.clientId)
      .maybeSingle(),
    supabase.from("baselines").select("*").eq("client_id", params.clientId).maybeSingle(),
    supabase.from("monthly_report_settings").select("*").eq("client_id", params.clientId).maybeSingle(),
  ]);

  if (!clientRow || !reportRow) notFound();
  const client = mapClient(clientRow);
  const report = mapMonthlyReport(reportRow);
  const baseline = baselineRow ? mapBaseline(baselineRow) : null;
  const settings = settingsRow ? mapMonthlyReportSettings(settingsRow) : null;

  const [{ data: metricRows }, { data: taskRows }, { data: allReportRows }, { data: emailDraftRow }] = await Promise.all([
    supabase.from("monthly_report_metrics").select("*").eq("monthly_report_id", report.id),
    supabase.from("monthly_report_tasks").select("*").eq("monthly_report_id", report.id).order("sort_index"),
    supabase
      .from("monthly_reports")
      .select("id, period_label, period_start")
      .eq("client_id", client.id)
      .order("period_start", { ascending: true }),
    supabase.from("monthly_report_email_drafts").select("*").eq("monthly_report_id", report.id).maybeSingle(),
  ]);

  const metrics = (metricRows ?? []).map(mapMonthlyReportMetric);
  const tasks = (taskRows ?? []).map(mapMonthlyReportTask);
  const emailDraft = emailDraftRow ? mapMonthlyReportEmailDraft(emailDraftRow) : null;
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
  const impressionsCurrent = metricByKey.get("impressions")?.valueNumber ?? null;
  const clicksCurrent = metricByKey.get("clicks")?.valueNumber ?? null;
  const impressionsGrowth = baseline
    ? computeGrowthPct(impressionsCurrent, baseline.organicImpressions)
    : null;
  const clicksGrowth = baseline ? computeGrowthPct(clicksCurrent, baseline.organicClicks) : null;

  const metricKeys = Object.keys(METRIC_LABELS) as MonthlyMetricKey[];
  const accent = report.accentColor;
  const accentBg = accentBgFor(accent);
  const eyebrow = settings?.agencyLabel ?? client.brand;

  return (
    <div style={{ background: C.pageBg, padding: "34px 16px", margin: "-2rem -1.5rem" }}>
      <style>{`
        @media print {
          @page { margin: 13mm; }
          body { background: #fff !important; }
          .report-app { box-shadow: none !important; margin: 0 !important; max-width: none !important; border-radius: 0 !important; }
          .avoid-break { break-inside: avoid; }
          .notes-block[data-empty="1"] { display: none !important; }
        }
      `}</style>
      <div
        className={`report-app ${dmSerifDisplay.variable} ${dmSans.variable}`}
        style={{
          maxWidth: 920,
          margin: "0 auto",
          background: C.cardBg,
          borderRadius: 14,
          boxShadow: "0 18px 60px rgba(0,0,0,.16)",
          overflow: "hidden",
        }}
      >
        {/* toolbar */}
        <div
          className="print:hidden"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "11px 22px",
            background: C.toolbarBg,
            borderBottom: `1px solid ${C.borderLight}`,
          }}
        >
          <span style={{ font: "500 11.5px/1 var(--font-dm-sans)", color: C.muted }}>
            {client.brand} · {report.periodLabel}
          </span>
          <div className="flex items-center gap-2">
            <StatusControl reportId={report.id} status={report.status} />
            <RefreshButton reportId={report.id} />
            <PrintButton />
          </div>
        </div>

        {/* header */}
        <div
          style={{
            padding: "34px 44px 26px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: "700 10px/1 var(--font-dm-sans)",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: C.orange,
                marginBottom: 12,
              }}
            >
              {eyebrow}
            </div>
            <div style={{ font: "400 31px/1.05 var(--font-dm-serif)", color: C.darkTeal }}>SEO Progress Report</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
              <span
                style={{
                  font: "600 10px/1 var(--font-dm-sans)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: C.mutedLight,
                }}
              >
                Prepared for
              </span>
              <span style={{ font: "600 15px/1.2 var(--font-dm-sans)", color: C.text }}>{client.brand}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div
              style={{
                font: "700 9px/1 var(--font-dm-sans)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: C.mutedLight,
                marginBottom: 6,
              }}
            >
              Reporting period
            </div>
            <div style={{ font: "600 13px/1.3 var(--font-dm-sans)", color: C.text }}>{report.periodLabel}</div>
            <div style={{ font: "400 12px/1.3 var(--font-dm-sans)", color: C.muted }}>
              {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
            </div>
          </div>
        </div>

        {!baseline && (
          <p className="print:hidden m-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No baseline set for this client — growth percentages won&apos;t show until one is saved on the Monthly
            Reports settings page.
          </p>
        )}

        <HeroStats
          workDelivered={workDelivered}
          spanLabel={report.periodLabel}
          impressionsGrowthPct={impressionsGrowth}
          impressionsBaseline={baseline?.organicImpressions ?? null}
          impressionsCurrent={impressionsCurrent}
          clicksGrowthPct={clicksGrowth}
          clicksBaseline={baseline?.organicClicks ?? null}
          clicksCurrent={clicksCurrent}
        />

        {/* trend chart */}
        <div className="avoid-break" style={{ padding: "28px 44px 30px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div style={{ font: "400 18px/1 var(--font-dm-serif)", color: C.darkTeal }}>Organic impressions over time</div>
            <div style={{ font: "400 12px/1 var(--font-dm-sans)", color: C.muted }}>Google Search Console</div>
          </div>
          <TrendChart points={trendPoints} />
        </div>

        <WorkStrip
          issuesFixed={countByListKey(tasks, "issues")}
          pagesOptimised={countByListKey(tasks, "pages_optimised")}
          newPages={countByListKey(tasks, "new_pages")}
          backlinksBuilt={countByListKey(tasks, "backlinks")}
          blogPosts={countByListKey(tasks, "blog_posts")}
          gbpPosts={metricByKey.get("gbp_posts")?.valueNumber ?? 0}
        />

        {baseline && <BaselineDisplay baseline={baseline} />}

        {/* this period's section */}
        <div className="mo-sec" style={{ padding: "26px 44px 30px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              marginBottom: 16,
              paddingLeft: 14,
              borderLeft: `4px solid ${accent}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
              <span
                style={{
                  font: "700 10px/1 var(--font-dm-sans)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: accent,
                  background: accentBg,
                  padding: "5px 11px",
                  borderRadius: 100,
                }}
              >
                {report.periodLabel}
              </span>
              <span style={{ font: "400 19px/1.1 var(--font-dm-serif)", color: C.text }}>{report.title}</span>
            </div>
            {report.subtitle && (
              <div style={{ font: "400 12.5px/1.4 var(--font-dm-sans)", color: C.muted }}>{report.subtitle}</div>
            )}
          </div>

          {/* metric cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 13,
              marginBottom: 20,
            }}
          >
            {metricKeys.map((key) => {
              const metric = metricByKey.get(key);
              if (!metric) return null;
              const baselineField = BASELINE_KEY_MAP[key];
              const baselineValue = baseline && baselineField ? (baseline[baselineField] as number) : null;
              return <MetricRow key={key} metric={metric} baselineValue={baselineValue} accent={accent} />;
            })}
          </div>

          {/* detail lists */}
          <div
            style={{
              font: "700 9.5px/1 var(--font-dm-sans)",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#bbb",
              marginBottom: 12,
            }}
          >
            Detail — what we did
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 22px" }}>
            {DETAIL_LIST_KEYS.map((listKey) => (
              <div
                key={listKey}
                className="avoid-break"
                style={{
                  border: `1px solid ${C.borderCard}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  background: C.subtleBg2,
                }}
              >
                <div style={{ font: "600 11px/1.3 var(--font-dm-sans)", color: C.darkTeal, marginBottom: 10 }}>
                  {TASK_LIST_LABELS[listKey]}
                </div>
                <DetailList reportId={report.id} listKey={listKey} tasks={tasks.filter((t) => t.listKey === listKey)} accent={accent} />
              </div>
            ))}
          </div>

          <NotesBlock reportId={report.id} tasks={tasks.filter((t) => t.listKey === "notes")} accent={accent} accentBg={accentBg} />
        </div>

        {/* footer */}
        <div
          style={{
            padding: "22px 44px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            font: "400 11px/1.4 var(--font-dm-sans)",
            color: C.mutedLight,
          }}
        >
          <span>
            {client.brand} — SEO Progress Report
          </span>
          <span>Generated {formatDate(new Date().toISOString())}</span>
        </div>
      </div>

      <Card className="print:hidden mx-auto mt-8" style={{ maxWidth: 920 }}>
        <CardHeader>
          <CardTitle>Draft client email</CardTitle>
          <CardDescription>Grounded in this report&apos;s data. Review and approve before sending — nothing sends automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <DraftEmailPanel reportId={report.id} draft={emailDraft} />
        </CardContent>
      </Card>
    </div>
  );
}
