import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchGscTotals } from "@/lib/googleReporting";

/**
 * Pulls live GSC impressions/clicks for this report's date range and
 * updates those two metrics. A manual override always wins: auto_value and
 * fetched_at update either way (so the operator can see what the source
 * says now), but value_number only changes when the metric isn't
 * overridden. GSC not configured, or the call failing, never blocks the
 * report -- everything just stays manual.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: report } = await supabase
    .from("monthly_reports")
    .select("id, client_id, period_start, period_end")
    .eq("id", params.id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from("monthly_report_settings")
    .select("gsc_site_url")
    .eq("client_id", report.client_id)
    .maybeSingle();

  const updated: string[] = [];
  const errors: Record<string, string> = {};

  if (settings?.gsc_site_url) {
    try {
      const totals = await fetchGscTotals(settings.gsc_site_url, report.period_start, report.period_end);
      const fetchedAt = new Date().toISOString();

      for (const [key, value] of [
        ["impressions", totals.impressions],
        ["clicks", totals.clicks],
      ] as const) {
        const { data: metric } = await supabase
          .from("monthly_report_metrics")
          .select("id, is_overridden")
          .eq("monthly_report_id", report.id)
          .eq("key", key)
          .maybeSingle();

        if (!metric) continue;

        await supabase
          .from("monthly_report_metrics")
          .update({
            source: "gsc",
            auto_value: value,
            fetched_at: fetchedAt,
            ...(metric.is_overridden ? {} : { value_number: value }),
          })
          .eq("id", metric.id);

        updated.push(key);
      }
    } catch (err) {
      errors.gsc = err instanceof Error ? err.message : "GSC fetch failed.";
    }
  }

  await supabase.from("monthly_reports").update({ generated_at: new Date().toISOString() }).eq("id", report.id);

  return NextResponse.json({ updated, errors });
}
