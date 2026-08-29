// Supabase Edge Function: run-crawl
//
// Triggered by POST /api/crawl ("run now") or the monthly cron. Crawls a
// handful of same-domain pages itself (plain fetch — no external crawl
// service or licensed CLI required), then hands the extracted page data to
// Claude to identify technical SEO issues. Also pulls Core Web Vitals from
// PageSpeed Insights, which stays independent of the crawl since it needs
// real user / Lighthouse data that no page fetch can produce.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RunCrawlPayload {
  auditId: string;
  clientId: string;
  domain: string;
}

interface CrawledPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  noindex: boolean;
  responseTimeMs: number;
  fetchError: string | null;
}

const MAX_PAGES = 15;
const FETCH_TIMEOUT_MS = 8000;
const CRAWL_MODEL = "claude-sonnet-5";

async function fetchPage(url: string): Promise<CrawledPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SEOAuditAgent/1.0 (+technical-crawl)" },
    });
    const responseTimeMs = Date.now() - startedAt;
    const html = res.headers.get("content-type")?.includes("text/html") ? await res.text() : "";

    return {
      url,
      statusCode: res.status,
      title: extract(html, /<title[^>]*>([^<]*)<\/title>/i),
      metaDescription: extract(
        html,
        /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
      ),
      h1: extract(html, /<h1[^>]*>(.*?)<\/h1>/is)?.replace(/<[^>]+>/g, "").trim() ?? null,
      wordCount: html
        ? html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
        : 0,
      noindex: /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["']/i.test(html),
      responseTimeMs,
      fetchError: null,
    };
  } catch (err) {
    return {
      url,
      statusCode: 0,
      title: null,
      metaDescription: null,
      h1: null,
      wordCount: 0,
      noindex: false,
      responseTimeMs: Date.now() - startedAt,
      fetchError: err instanceof Error ? err.message : "Unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extract(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractSameDomainLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links = new Set<string>();
  const hrefPattern = /<a\s[^>]*href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl);
      if (resolved.hostname === base.hostname && (resolved.protocol === "http:" || resolved.protocol === "https:")) {
        resolved.hash = "";
        links.add(resolved.toString());
      }
    } catch {
      // Ignore unparseable hrefs (mailto:, javascript:, etc).
    }
  }
  return Array.from(links);
}

/** Breadth-first crawl of up to MAX_PAGES same-domain pages starting from the homepage. */
async function crawlSite(domain: string): Promise<CrawledPage[]> {
  const rootUrl = domain.endsWith("/") ? domain : `${domain}/`;
  const visited = new Set<string>();
  const queue: string[] = [rootUrl];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html = "";
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "SEOAuditAgent/1.0" } });
      if (res.headers.get("content-type")?.includes("text/html")) {
        html = await res.text();
      }
    } catch {
      // Link discovery is best-effort; fetchPage() below records the real error per-page.
    } finally {
      clearTimeout(timeout);
    }

    const page = await fetchPage(url);
    pages.push(page);

    if (html && pages.length < MAX_PAGES) {
      for (const link of extractSameDomainLinks(html, url)) {
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    }
  }

  return pages;
}

const ISSUES_TOOL = {
  name: "report_issues",
  description: "Report the technical SEO issues found across the crawled pages.",
  input_schema: {
    type: "object" as const,
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["cwv", "broken_link", "page_structure", "indexability", "meta"],
            },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            url: { type: "string" },
            description: { type: "string" },
          },
          required: ["category", "severity", "url", "description"],
        },
      },
    },
    required: ["issues"],
  },
};

const AUDIT_SYSTEM_PROMPT = `You are a technical SEO auditor reviewing pages crawled from a client's website.
You are given, per page: URL, HTTP status code, title, meta description, H1, approximate word count,
whether it's marked noindex, response time, and any fetch error.

Identify concrete technical issues only — never invent a page or URL that isn't in the provided data.
Categorize each issue into exactly one of: cwv, broken_link, page_structure, indexability, meta.
- broken_link: status code >= 400, or a fetch error
- indexability: noindex is true on a page that should be indexable, or the page is unreachable
- meta: missing/duplicate/too-long title or meta description
- page_structure: missing H1, thin content (very low word count for what looks like a content page)
- cwv: response time is notably slow (over ~2s)

Assign severity by real-world impact: critical for 5xx/unreachable pages or noindex on what looks like
a key page (e.g. the homepage), high for 4xx or missing meta on important-looking pages, medium/low for
smaller issues like a slightly long title or moderately thin content. Skip pages with no real issues —
do not report an issue just to have one per page.`;

interface ParsedIssue {
  category: string;
  severity: string;
  url: string;
  description: string;
}

async function analyzeWithClaude(pages: CrawledPage[]): Promise<ParsedIssue[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured for this project's Edge Functions.");
  }

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: CRAWL_MODEL,
    max_tokens: 4000,
    system: AUDIT_SYSTEM_PROMPT,
    tools: [ISSUES_TOOL],
    tool_choice: { type: "tool", name: "report_issues" },
    messages: [
      {
        role: "user",
        content: `Crawled page data (${pages.length} pages):\n\n${JSON.stringify(pages, null, 2)}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured issues report.");
  }
  const input = toolUse.input as { issues?: ParsedIssue[] };
  return input.issues ?? [];
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

    const pages = await crawlSite(domain);

    await supabase.from("audits").update({ status: "analyzing" }).eq("id", auditId);

    const issues = await analyzeWithClaude(pages);
    if (issues.length > 0) {
      await supabase.from("issues").insert(
        issues.map((issue) => ({
          audit_id: auditId,
          client_id: clientId,
          category: issue.category,
          severity: issue.severity,
          url: issue.url,
          description: issue.description,
        })),
      );
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

    const brokenLinkCount = issues.filter((i) => i.category === "broken_link").length;
    await supabase.from("metric_snapshots").insert({
      client_id: clientId,
      audit_id: auditId,
      metric: "broken_link_count",
      value: brokenLinkCount,
    });

    await supabase.from("audits").update({ status: "complete" }).eq("id", auditId);

    await supabase.functions.invoke("alert-check", { body: { auditId, clientId } });

    return new Response(JSON.stringify({ ok: true, pagesCrawled: pages.length, issuesFound: issues.length }), {
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
