import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeScheduledSendDate } from "@/lib/monthlyReportDerive";
import { accentForIndex } from "@/lib/reportTheme";
import { METRIC_LABELS, type MetricSource, type MonthlyMetricKey } from "@/lib/monthlyReportTypes";

type SupabaseDb = SupabaseClient<Database>;

function currentMonthBounds(): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

interface MonthlyReportSettingsRow {
  client_id: string;
  send_day_of_month: number;
  gsc_site_url: string | null;
  backlinks_sheet_id: string | null;
  backlinks_sheet_tab: string | null;
  gbp_location_id: string | null;
}

/**
 * Creates this calendar month's report for a client if one doesn't already
 * exist, seeded with the standard metric rows (auto-sourced where the
 * client's settings allow) -- mirrors NewMonthlyReportForm's creation logic
 * so a report created this way looks identical to a manually-created one.
 * Returns the new report id, or null if a report for this month already
 * exists (idempotent -- safe to call every day).
 */
export async function createMonthlyReportIfMissing(
  supabase: SupabaseDb,
  settings: MonthlyReportSettingsRow,
): Promise<string | null> {
  const { start, end, label } = currentMonthBounds();

  const { data: existing } = await supabase
    .from("monthly_reports")
    .select("id")
    .eq("client_id", settings.client_id)
    .eq("period_start", start)
    .maybeSingle();
  if (existing) return null;

  const { count } = await supabase
    .from("monthly_reports")
    .select("id", { count: "exact", head: true })
    .eq("client_id", settings.client_id);

  const gscConfigured = Boolean(settings.gsc_site_url);
  const sheetConfigured = Boolean(settings.backlinks_sheet_id && settings.backlinks_sheet_tab);
  const gbpConfigured = Boolean(settings.gbp_location_id);
  const sourceForKey = (key: MonthlyMetricKey): MetricSource => {
    if ((key === "impressions" || key === "clicks") && gscConfigured) return "gsc";
    if (key === "backlinks_built" && sheetConfigured) return "sheet";
    if (key === "gbp_posts" && gbpConfigured) return "gbp";
    return "manual";
  };

  const { data: report, error } = await supabase
    .from("monthly_reports")
    .insert({
      client_id: settings.client_id,
      period_label: label,
      period_start: start,
      period_end: end,
      scheduled_send_date: computeScheduledSendDate(end, settings.send_day_of_month),
      accent_color: accentForIndex(count ?? 0).accent,
    })
    .select("id")
    .single();
  if (error || !report) throw error ?? new Error("Failed to create monthly report.");

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

  return report.id;
}
