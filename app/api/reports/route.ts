import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapClient, mapIssue, mapReport } from "@/lib/queries";
import { generateReportDraft } from "@/lib/claude";
import { sendReportEmail, saveReportToDrive } from "@/lib/google";
import type { MetricName } from "@/lib/types";

const generateSchema = z.object({ clientId: z.string().uuid() });
const sendSchema = z.object({
  reportId: z.string().uuid(),
  sendVia: z.enum(["gmail", "drive"]),
  recipientEmail: z.string().email().nullable().optional(),
});

const TRACKED_METRICS: MetricName[] = ["lcp", "cls", "inp"];

/** Generates a new report draft from the two most recent completed audits. */
export async function PUT(request: Request) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!clientRow) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }
  const client = mapClient(clientRow);

  const { data: completedAudits } = await supabase
    .from("audits")
    .select("id, run_at")
    .eq("client_id", client.id)
    .eq("status", "complete")
    .order("run_at", { ascending: false })
    .limit(2);

  if (!completedAudits || completedAudits.length === 0) {
    return NextResponse.json(
      { error: "No completed audits yet — run a crawl before generating a report." },
      { status: 409 },
    );
  }

  const [latestAudit, previousAudit] = completedAudits;
  const periodStart = previousAudit?.run_at ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const periodEnd = latestAudit.run_at;

  const [{ data: fixedIssueRows }, { data: openIssueRows }, { data: metricRows }] = await Promise.all([
    supabase
      .from("issues")
      .select("*")
      .eq("client_id", client.id)
      .eq("status", "fixed")
      .gte("fixed_at", periodStart)
      .limit(25),
    supabase
      .from("issues")
      .select("*")
      .eq("client_id", client.id)
      .eq("status", "open")
      .order("severity", { ascending: true })
      .limit(10),
    supabase
      .from("metric_snapshots")
      .select("*")
      .eq("client_id", client.id)
      .in("audit_id", previousAudit ? [latestAudit.id, previousAudit.id] : [latestAudit.id]),
  ]);

  const fixedIssues = (fixedIssueRows ?? []).map(mapIssue);
  const openIssues = (openIssueRows ?? []).map(mapIssue);

  const metricDeltas = TRACKED_METRICS.map((metric) => {
    const before = metricRows?.find((m) => m.audit_id === previousAudit?.id && m.metric === metric)?.value ?? null;
    const after = metricRows?.find((m) => m.audit_id === latestAudit.id && m.metric === metric)?.value ?? null;
    return { metric, before, after };
  }).filter((d) => d.before != null || d.after != null);

  let content: string;
  try {
    content = await generateReportDraft({
      client,
      periodStart,
      periodEnd,
      fixedIssues,
      openIssues,
      metricDeltas,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report drafting failed." },
      { status: 502 },
    );
  }

  const { data: report, error: insertError } = await supabase
    .from("reports")
    .insert({
      client_id: client.id,
      period_start: periodStart.slice(0, 10),
      period_end: periodEnd.slice(0, 10),
      audit_ids: previousAudit ? [latestAudit.id, previousAudit.id] : [latestAudit.id],
      status: "draft",
      content,
    })
    .select("id")
    .single();

  if (insertError || !report) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to save draft." }, { status: 500 });
  }

  return NextResponse.json({ reportId: report.id }, { status: 201 });
}

/** Sends an approved report via Gmail or saves it to Drive, then marks it sent. */
export async function POST(request: Request) {
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "reportId and sendVia are required." }, { status: 400 });
  }
  const { reportId, sendVia, recipientEmail } = parsed.data;

  if (sendVia === "gmail" && !recipientEmail) {
    return NextResponse.json({ error: "recipientEmail is required to send via Gmail." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: reportRow } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (!reportRow) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const report = mapReport(reportRow);

  if (report.status !== "approved") {
    return NextResponse.json({ error: "A report can't be sent while it's still a draft." }, { status: 409 });
  }

  const { data: clientRow } = await supabase.from("clients").select("*").eq("id", report.clientId).maybeSingle();
  if (!clientRow) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }
  const client = mapClient(clientRow);

  try {
    if (sendVia === "gmail") {
      await sendReportEmail(client, report, recipientEmail!);
    } else {
      await saveReportToDrive(client, report);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delivery failed." },
      { status: 502 },
    );
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({ status: "sent", sent_via: sendVia, sent_at: new Date().toISOString() })
    .eq("id", reportId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
