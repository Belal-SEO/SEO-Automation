import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createMonthlyReportIfMissing } from "@/lib/monthlyReportAutoCreate";
import { refreshMonthlyReport } from "@/lib/monthlyReportRefresh";

/**
 * Scheduled entry point (see vercel.json) that creates this calendar
 * month's report for every client with Monthly Reporting configured, so
 * the cycle doesn't require manually clicking "Create report" each month.
 * Idempotent -- a client that already has a report for the current month
 * is skipped. Runs daily, well before the review-reminder cron, so a
 * fresh report and its live metrics exist before anything drafts an email
 * against it.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: settingsRows, error } = await supabase.from("monthly_report_settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const created: string[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const settings of settingsRows ?? []) {
    try {
      const reportId = await createMonthlyReportIfMissing(supabase, settings);
      if (reportId) {
        created.push(settings.client_id);
        await refreshMonthlyReport(reportId).catch(() => {
          // A refresh failure shouldn't stop the report from existing --
          // metrics just stay unset until a manual refresh or retry.
        });
      }
    } catch (err) {
      failed.push({ clientId: settings.client_id, error: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  return NextResponse.json({ created, failed });
}
