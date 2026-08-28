// Supabase Edge Function: generate-report
//
// On-demand equivalent of POST /api/reports (PUT) for use by the monthly
// cron job, so scheduled runs don't depend on the Next.js app being awake.
// Sends the audit deltas to Claude and stores the draft in `reports`.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { corsHeaders } from "../_shared/cors.ts";

const REPORT_MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are drafting a monthly technical SEO update for a marketing agency's client.
Ground every claim strictly in the structured audit data provided in the user message — never invent
numbers, pages, or fixes that are not in the data.

Tone: plain language, outcome-framed (visibility, site speed, user experience), never raw keyword
rankings or SEO jargon. Write as if explaining "here is what we fixed and why it matters" to a
non-technical clinic owner. Keep it warm but concrete — cite specific pages and before/after numbers
when they are available.

Output clean Markdown with this structure:
1. A one-paragraph summary of the period's outcome.
2. "What we fixed" — bullet list, each tied to a real issue from the data.
3. "Site health trends" — before/after Core Web Vitals if metric data is present.
4. "What's next" — top open issues, framed as the team's next priority, not the client's fault.

If there is no data for a section (e.g. no metric deltas), omit that section rather than fabricating it.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { clientId } = await req.json().catch(() => ({}));
  if (!clientId) {
    return new Response(JSON.stringify({ error: "clientId is required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Client not found.");

    const { data: completedAudits } = await supabase
      .from("audits")
      .select("id, run_at")
      .eq("client_id", clientId)
      .eq("status", "complete")
      .order("run_at", { ascending: false })
      .limit(2);

    if (!completedAudits || completedAudits.length === 0) {
      throw new Error("No completed audits yet — run a crawl before generating a report.");
    }

    const [latestAudit, previousAudit] = completedAudits;
    const periodStart = previousAudit?.run_at ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = latestAudit.run_at;

    const [{ data: fixedIssues }, { data: openIssues }, { data: metricRows }] = await Promise.all([
      supabase.from("issues").select("*").eq("client_id", clientId).eq("status", "fixed").gte("fixed_at", periodStart).limit(25),
      supabase.from("issues").select("*").eq("client_id", clientId).eq("status", "open").limit(10),
      supabase
        .from("metric_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .in("audit_id", previousAudit ? [latestAudit.id, previousAudit.id] : [latestAudit.id]),
    ]);

    const metricDeltas = ["lcp", "cls", "inp"]
      .map((metric) => ({
        metric,
        before: metricRows?.find((m) => m.audit_id === previousAudit?.id && m.metric === metric)?.value ?? null,
        after: metricRows?.find((m) => m.audit_id === latestAudit.id && m.metric === metric)?.value ?? null,
      }))
      .filter((d) => d.before != null || d.after != null);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: REPORT_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Structured audit data for this report:\n\n${JSON.stringify(
            {
              client: { name: client.name, brand: client.brand, domain: client.domain },
              period: { start: periodStart, end: periodEnd },
              fixedIssues,
              stillOpenIssues: openIssues,
              metricDeltas,
            },
            null,
            2,
          )}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text content.");

    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        client_id: clientId,
        period_start: periodStart.slice(0, 10),
        period_end: periodEnd.slice(0, 10),
        audit_ids: previousAudit ? [latestAudit.id, previousAudit.id] : [latestAudit.id],
        status: "draft",
        content: textBlock.text,
      })
      .select("id")
      .single();

    if (insertError || !report) throw new Error(insertError?.message ?? "Failed to save draft.");

    return new Response(JSON.stringify({ reportId: report.id }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
