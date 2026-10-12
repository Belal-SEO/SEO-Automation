import { NextResponse } from "next/server";
import { z } from "zod";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/teamAccess";

const bodySchema = z.object({ clientId: z.string().uuid(), model: z.string().min(1).optional() });

/**
 * Triggers a technical crawl for a client. Creates the Audit row and hands
 * off to the `run-crawl` Supabase Edge Function, which does the actual work
 * (self-fetches a handful of same-domain pages, has a model of your choice
 * identify issues via OpenRouter, pulls PSI Core Web Vitals) and can run
 * longer than a Vercel serverless function's timeout allows.
 */
export async function POST(request: Request) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

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
    body: { auditId: audit.id, clientId: client.id, domain: client.domain, model: parsed.data.model },
  });

  if (invokeError) {
    // supabase-js's invoke() only gives a generic "non-2xx status code" message by
    // default -- the run-crawl function's own error detail is in the response body,
    // which also already wrote it to this audit row before returning. Read it back
    // from the response so we don't clobber that with the generic message.
    let message = invokeError.message;
    if (invokeError instanceof FunctionsHttpError) {
      try {
        const body = await invokeError.context.json();
        if (typeof body?.error === "string") message = body.error;
      } catch {
        // Response wasn't JSON -- fall back to the generic invoke message.
      }
    }
    await supabase.from("audits").update({ status: "failed", error: message }).eq("id", audit.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ auditId: audit.id }, { status: 202 });
}
