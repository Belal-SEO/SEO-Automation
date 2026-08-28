// Supabase Edge Function: alert-check
//
// Runs after every completed crawl (invoked by run-crawl). Counts new
// critical issues from the audit that just finished; if the client's
// configured threshold is met, posts to ALERT_WEBHOOK_URL (e.g. a Slack
// incoming webhook) so the specialist finds out before the client does.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { auditId, clientId } = await req.json().catch(() => ({}));
  if (!auditId || !clientId) {
    return new Response(JSON.stringify({ error: "auditId and clientId are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("brand, critical_alert_threshold")
    .eq("id", clientId)
    .single();

  const { count: newCriticalCount } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", auditId)
    .eq("severity", "critical");

  const threshold = client?.critical_alert_threshold ?? 1;
  const shouldAlert = (newCriticalCount ?? 0) >= threshold;

  if (shouldAlert) {
    const webhookUrl = Deno.env.get("ALERT_WEBHOOK_URL");
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `⚠️ ${client?.brand ?? clientId}: ${newCriticalCount} critical issue(s) found in the latest audit.`,
        }),
      }).catch((err) => console.error("Alert webhook failed:", err));
    } else {
      console.warn(`ALERT_WEBHOOK_URL not configured — skipped alert for ${client?.brand ?? clientId}.`);
    }
  }

  return new Response(JSON.stringify({ alerted: shouldAlert, newCriticalCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
