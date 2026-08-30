import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapClient } from "@/lib/queries";
import { mapBaseline, mapMonthlyReport, mapMonthlyReportMetric, mapMonthlyReportTask } from "@/lib/monthlyReportQueries";
import { generateEmailDraft } from "@/lib/monthlyReportEmail";

/** Generates (or regenerates) the draft client email for a report and upserts it. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();

  const { data: reportRow } = await supabase.from("monthly_reports").select("*").eq("id", params.id).maybeSingle();
  if (!reportRow) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const report = mapMonthlyReport(reportRow);

  const [{ data: clientRow }, { data: settingsRow }, { data: baselineRow }, { data: metricRows }, { data: taskRows }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", report.clientId).maybeSingle(),
      supabase.from("monthly_report_settings").select("client_email").eq("client_id", report.clientId).maybeSingle(),
      supabase.from("baselines").select("*").eq("client_id", report.clientId).maybeSingle(),
      supabase.from("monthly_report_metrics").select("*").eq("monthly_report_id", report.id),
      supabase.from("monthly_report_tasks").select("*").eq("monthly_report_id", report.id),
    ]);

  if (!clientRow) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const client = mapClient(clientRow);
  const baseline = baselineRow ? mapBaseline(baselineRow) : null;
  const metrics = (metricRows ?? []).map(mapMonthlyReportMetric);
  const tasks = (taskRows ?? []).map(mapMonthlyReportTask);

  let draft: { subject: string; body: string };
  try {
    draft = await generateEmailDraft({ client, report, baseline, metrics, tasks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed." },
      { status: 502 },
    );
  }

  const { data: saved, error: upsertError } = await supabase
    .from("monthly_report_email_drafts")
    .upsert(
      {
        monthly_report_id: report.id,
        to_email: settingsRow?.client_email ?? null,
        subject: draft.subject,
        body: draft.body,
        status: "draft",
        generated_at: new Date().toISOString(),
      },
      { onConflict: "monthly_report_id" },
    )
    .select("*")
    .single();

  if (upsertError || !saved) {
    return NextResponse.json({ error: upsertError?.message ?? "Failed to save draft." }, { status: 500 });
  }

  return NextResponse.json({ draft: saved });
}
