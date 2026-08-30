import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPlainEmail } from "@/lib/google";
import { mapClient } from "@/lib/queries";
import { mapBaseline, mapMonthlyReport, mapMonthlyReportMetric, mapMonthlyReportTask } from "@/lib/monthlyReportQueries";
import { refreshMonthlyReport } from "@/lib/monthlyReportRefresh";
import { generateEmailDraft } from "@/lib/monthlyReportEmail";

/**
 * Scheduled entry point (see vercel.json) for the monthly review reminder.
 * For every report whose scheduled_send_date minus the client's
 * review_lead_days is today or earlier (and hasn't been reminded yet),
 * refreshes live sources, ensures a draft client email exists, and emails
 * the operator (NOTIFY_EMAIL) a link to review it. Never auto-sends to the
 * client -- the operator always reviews and sends.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    return NextResponse.json({ error: "NOTIFY_EMAIL is not configured." }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const origin = new URL(request.url).origin;
  const todayUtc = new Date().toISOString().slice(0, 10);

  // Broad candidate set -- reports not yet sent or reminded, due within a
  // safety window -- then filter precisely in JS using each client's
  // review_lead_days (which we don't have a column to compare against here).
  const windowEnd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { data: candidates, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .is("reminder_sent_at", null)
    .neq("status", "sent")
    .lte("scheduled_send_date", windowEnd);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reminded: string[] = [];
  const failed: { reportId: string; error: string }[] = [];

  for (const row of candidates ?? []) {
    const report = mapMonthlyReport(row);

    const { data: settingsRow } = await supabase
      .from("monthly_report_settings")
      .select("review_lead_days")
      .eq("client_id", report.clientId)
      .maybeSingle();
    const reviewLeadDays = settingsRow?.review_lead_days ?? 3;

    const dueDate = new Date(`${report.scheduledSendDate}T00:00:00Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() - reviewLeadDays);
    if (dueDate.toISOString().slice(0, 10) > todayUtc) continue; // not due yet

    try {
      await refreshMonthlyReport(report.id).catch(() => {
        // A refresh failure shouldn't stop the reminder from going out.
      });

      const { data: clientRow } = await supabase.from("clients").select("*").eq("id", report.clientId).maybeSingle();
      if (!clientRow) throw new Error("Client not found.");
      const client = mapClient(clientRow);

      const [{ data: baselineRow }, { data: metricRows }, { data: taskRows }, { data: existingDraft }] =
        await Promise.all([
          supabase.from("baselines").select("*").eq("client_id", report.clientId).maybeSingle(),
          supabase.from("monthly_report_metrics").select("*").eq("monthly_report_id", report.id),
          supabase.from("monthly_report_tasks").select("*").eq("monthly_report_id", report.id),
          supabase.from("monthly_report_email_drafts").select("*").eq("monthly_report_id", report.id).maybeSingle(),
        ]);

      const baseline = baselineRow ? mapBaseline(baselineRow) : null;
      const metrics = (metricRows ?? []).map(mapMonthlyReportMetric);
      const tasks = (taskRows ?? []).map(mapMonthlyReportTask);

      let draftSubject = existingDraft?.subject;
      let draftBody = existingDraft?.body;
      if (!existingDraft) {
        const draft = await generateEmailDraft({ client, report, baseline, metrics, tasks });
        draftSubject = draft.subject;
        draftBody = draft.body;
        await supabase.from("monthly_report_email_drafts").upsert({
          monthly_report_id: report.id,
          subject: draft.subject,
          body: draft.body,
          status: "draft",
          generated_at: new Date().toISOString(),
        });
      }

      const reportUrl = `${origin}/clients/${report.clientId}/monthly-reports/${report.id}`;
      const reminderHtml = `
        <p><strong>${client.brand}</strong> — ${report.periodLabel} is due for review.</p>
        <p>Scheduled to send: ${report.scheduledSendDate}</p>
        <p><a href="${reportUrl}">Open the report</a></p>
        <hr/>
        <p><strong>Draft client email</strong></p>
        <p><em>Subject: ${draftSubject ?? "(not generated)"}</em></p>
        <p>${(draftBody ?? "").replace(/\n/g, "<br/>")}</p>
      `;

      await sendPlainEmail(notifyEmail, `Review due: ${client.brand} — ${report.periodLabel}`, reminderHtml);
      await supabase.from("monthly_reports").update({ reminder_sent_at: new Date().toISOString() }).eq("id", report.id);
      reminded.push(report.id);
    } catch (err) {
      failed.push({ reportId: report.id, error: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  return NextResponse.json({ reminded, failed });
}
