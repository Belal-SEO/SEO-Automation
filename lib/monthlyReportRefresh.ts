import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchGscTotals, fetchSheetBacklinks, fetchGbpPostCount } from "@/lib/googleReporting";

export interface RefreshResult {
  updated: string[];
  errors: Record<string, string>;
}

/**
 * Pulls every live source configured for a client (GSC, Sheets, GBP) and
 * updates the report's metrics. A manual override always wins: auto_value
 * and fetched_at update either way, but value_number only changes when the
 * metric isn't overridden. Any source failing (not configured, API error,
 * no GBP access yet) never blocks the others -- each is caught separately
 * and reported back, and everything just stays at its last/manual value.
 */
export async function refreshMonthlyReport(reportId: string): Promise<RefreshResult> {
  const supabase = createServiceRoleClient();
  const updated: string[] = [];
  const errors: Record<string, string> = {};

  const { data: report } = await supabase
    .from("monthly_reports")
    .select("id, client_id, period_start, period_end")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    throw new Error("Report not found.");
  }

  const { data: settings } = await supabase
    .from("monthly_report_settings")
    .select("gsc_site_url, backlinks_sheet_id, backlinks_sheet_tab, gbp_location_id")
    .eq("client_id", report.client_id)
    .maybeSingle();

  async function updateMetric(key: string, value: number, source: "gsc" | "sheet" | "gbp") {
    const { data: metric } = await supabase
      .from("monthly_report_metrics")
      .select("id, is_overridden")
      .eq("monthly_report_id", report!.id)
      .eq("key", key)
      .maybeSingle();
    if (!metric) return;

    await supabase
      .from("monthly_report_metrics")
      .update({
        source,
        auto_value: value,
        fetched_at: new Date().toISOString(),
        ...(metric.is_overridden ? {} : { value_number: value }),
      })
      .eq("id", metric.id);

    updated.push(key);
  }

  if (settings?.gsc_site_url) {
    try {
      const totals = await fetchGscTotals(settings.gsc_site_url, report.period_start, report.period_end);
      await updateMetric("impressions", totals.impressions, "gsc");
      await updateMetric("clicks", totals.clicks, "gsc");
    } catch (err) {
      errors.gsc = err instanceof Error ? err.message : "GSC fetch failed.";
    }
  }

  if (settings?.backlinks_sheet_id && settings.backlinks_sheet_tab) {
    try {
      const result = await fetchSheetBacklinks(
        settings.backlinks_sheet_id,
        settings.backlinks_sheet_tab,
        report.period_start,
        report.period_end,
      );
      await updateMetric("backlinks_built", result.count, "sheet");

      await supabase
        .from("monthly_report_tasks")
        .delete()
        .eq("monthly_report_id", report.id)
        .eq("list_key", "backlinks")
        .eq("source", "sheet");

      if (result.items.length > 0) {
        await supabase.from("monthly_report_tasks").insert(
          result.items.map((item, i) => ({
            monthly_report_id: report.id,
            list_key: "backlinks" as const,
            text: `${item.source} → ${item.target}`,
            url: item.target,
            source: "sheet" as const,
            sort_index: i,
          })),
        );
      }
    } catch (err) {
      errors.sheet = err instanceof Error ? err.message : "Sheets fetch failed.";
    }
  }

  if (settings?.gbp_location_id) {
    try {
      const result = await fetchGbpPostCount(settings.gbp_location_id, report.period_start, report.period_end);
      await updateMetric("gbp_posts", result.count, "gbp");
    } catch (err) {
      errors.gbp = err instanceof Error ? err.message : "GBP fetch failed.";
    }
  }

  await supabase.from("monthly_reports").update({ generated_at: new Date().toISOString() }).eq("id", report.id);

  return { updated, errors };
}
