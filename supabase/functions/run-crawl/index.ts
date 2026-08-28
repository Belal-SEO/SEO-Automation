// Supabase Edge Function: run-crawl
//
// Triggered by POST /api/crawl (manual "run now") or by a scheduled cron
// invocation for the monthly audit cycle. Screaming Frog's CLI needs a
// licensed, non-serverless machine to run (see PRD Q3) — so this function
// expects the crawl export to already exist as a CSV, either uploaded
// directly (`crawlExportCsv` in the body) or fetched from Supabase Storage
// (`crawlExportStoragePath`). Until that pipeline is wired up, it still
// captures Core Web Vitals from PageSpeed Insights so audits aren't empty.
import { createClient } from "npm:@supabase/supabase-js@2";
import { detectIssuesFromCrawl, parseScreamingFrogCsv } from "../_shared/screamingfrog.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface RunCrawlPayload {
  auditId: string;
  clientId: string;
  domain: string;
  crawlExportCsv?: string;
  crawlExportStoragePath?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: RunCrawlPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { auditId, clientId, domain } = payload;

  try {
    await supabase.from("audits").update({ status: "crawling" }).eq("id", auditId);

    let csvText = payload.crawlExportCsv ?? null;
    if (!csvText && payload.crawlExportStoragePath) {
      const { data, error } = await supabase.storage
        .from("audit-screenshots")
        .download(payload.crawlExportStoragePath);
      if (error) throw error;
      csvText = await data.text();
    }

    await supabase.from("audits").update({ status: "analyzing" }).eq("id", auditId);

    if (csvText) {
      const rows = parseScreamingFrogCsv(csvText);
      const parsedIssues = detectIssuesFromCrawl(rows);
      if (parsedIssues.length > 0) {
        await supabase.from("issues").insert(
          parsedIssues.map((issue) => ({
            audit_id: auditId,
            client_id: clientId,
            category: issue.category,
            severity: issue.severity,
            url: issue.url,
            description: issue.description,
          })),
        );
      }
    }

    const psiApiKey = Deno.env.get("PAGESPEED_API_KEY");
    try {
      const params = new URLSearchParams({ url: domain, strategy: "mobile", category: "performance" });
      if (psiApiKey) params.set("key", psiApiKey);
      const psiRes = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`);
      if (psiRes.ok) {
        const psiData = await psiRes.json();
        const field = psiData.loadingExperience?.metrics;
        const lab = psiData.lighthouseResult?.audits;
        const lcpMs = field?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? lab?.["largest-contentful-paint"]?.numericValue;
        const clsRaw = field?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
        const cls = clsRaw != null ? clsRaw / 100 : lab?.["cumulative-layout-shift"]?.numericValue;
        const inp = field?.INTERACTION_TO_NEXT_PAINT?.percentile;

        const metricRows = [
          lcpMs != null && { metric: "lcp", value: lcpMs / 1000 },
          cls != null && { metric: "cls", value: cls },
          inp != null && { metric: "inp", value: inp },
        ].filter(Boolean) as { metric: string; value: number }[];

        if (metricRows.length > 0) {
          await supabase.from("metric_snapshots").insert(
            metricRows.map((m) => ({ client_id: clientId, audit_id: auditId, metric: m.metric, value: m.value })),
          );
        }
      }
      // A PSI failure shouldn't fail the whole audit if crawl issues were captured.
    } catch (psiError) {
      console.error("PSI fetch failed:", psiError);
    }

    await supabase.from("audits").update({ status: "complete" }).eq("id", auditId);

    await supabase.functions.invoke("alert-check", { body: { auditId, clientId } });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown crawl error.";
    await supabase.from("audits").update({ status: "failed", error: message }).eq("id", auditId);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
