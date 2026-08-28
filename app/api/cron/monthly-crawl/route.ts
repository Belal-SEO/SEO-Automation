import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Scheduled entry point (see vercel.json) for the monthly audit cycle.
 * Queues an audit for every active client that's past its report cadence,
 * then hands off to the run-crawl Edge Function per client.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, domain, report_cadence_days")
    .eq("active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queued: string[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const client of clients ?? []) {
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .insert({ client_id: client.id, source: "screaming_frog", status: "queued" })
      .select("id")
      .single();

    if (auditError || !audit) {
      failed.push({ clientId: client.id, error: auditError?.message ?? "Failed to queue audit." });
      continue;
    }

    const { error: invokeError } = await supabase.functions.invoke("run-crawl", {
      body: { auditId: audit.id, clientId: client.id, domain: client.domain },
    });

    if (invokeError) {
      await supabase.from("audits").update({ status: "failed", error: invokeError.message }).eq("id", audit.id);
      failed.push({ clientId: client.id, error: invokeError.message });
    } else {
      queued.push(client.id);
    }
  }

  return NextResponse.json({ queued, failed });
}
