import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

const bodySchema = z.object({ clientId: z.string().uuid() });

/**
 * Triggers a technical crawl for a client. Creates the Audit row and hands
 * off to the `run-crawl` Supabase Edge Function, which does the actual work
 * (self-fetches a handful of same-domain pages, has Claude identify issues,
 * pulls PSI Core Web Vitals) and can run longer than a Vercel serverless
 * function's timeout allows.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, domain")
    .eq("id", parsed.data.clientId)
    .maybeSingle();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .insert({ client_id: client.id, source: "ai_crawl", status: "queued" })
    .select("id")
    .single();

  if (auditError || !audit) {
    return NextResponse.json({ error: auditError?.message ?? "Failed to queue audit." }, { status: 500 });
  }

  const { error: invokeError } = await supabase.functions.invoke("run-crawl", {
    body: { auditId: audit.id, clientId: client.id, domain: client.domain },
  });

  if (invokeError) {
    await supabase
      .from("audits")
      .update({ status: "failed", error: invokeError.message })
      .eq("id", audit.id);
    return NextResponse.json({ error: invokeError.message }, { status: 502 });
  }

  return NextResponse.json({ auditId: audit.id }, { status: 202 });
}
