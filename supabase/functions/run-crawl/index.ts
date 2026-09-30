// Supabase Edge Function: run-crawl
//
// Triggered by POST /api/crawl ("run now") or the monthly cron. Crawls a
// handful of same-domain pages itself (plain fetch — no external crawl
// service or licensed CLI required), extracts a broad set of on-page local
// SEO signals (structured data, NAP, canonical/meta/OG tags, image alt
// coverage, internal linking, robots/sitemap coverage), then hands all of
// it to a model (selectable per run, routed through OpenRouter — see
// analyzeWithOpenRouter) to identify and categorize issues. PageSpeed
// Insights stays independent of the crawl since it needs real user /
// Lighthouse data that no page fetch can produce.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RunCrawlPayload {
  auditId: string;
  clientId: string;
  domain: string;
  model?: string;
}

interface CrawledPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  noindex: boolean;
  canonicalUrl: string | null;
  hasViewportMeta: boolean;
  schemaTypes: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  phoneNumbers: string[];
  responseTimeMs: number;
  fetchError: string | null;
}

const MAX_PAGES = 25;
const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SEOAuditAgent/1.0 (+technical-crawl)" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extract(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractAll(html: string, pattern: RegExp): string[] {
  return Array.from(html.matchAll(pattern)).map((m) => m[1]);
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

function extractPhoneNumbers(html: string): string[] {
  const pattern = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;
  const found = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    found.add(match[0].trim());
    if (found.size >= 5) break;
  }
  return Array.from(found);
}

function extractSchemaTypes(html: string): string[] {
  const types = new Set<string>();
  for (const script of extractAll(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const match of script.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) {
      types.add(match[1]);
    }
  }
  return Array.from(types);
}

async function fetchAndAnalyzePage(url: string): Promise<{ page: CrawledPage; links: string[] }> {
  const startedAt = Date.now();
  try {
    const res = await fetchWithTimeout(url);
    const responseTimeMs = Date.now() - startedAt;
    const isHtml = res.headers.get("content-type")?.includes("text/html");
    const html = isHtml ? await res.text() : "";

    const images = extractAll(html, /<img\s[^>]*>/gi);
    const imagesMissingAlt = images.filter(
      (img) => !/\salt=["'][^"']+["']/i.test(img),
    ).length;

    const page: CrawledPage = {
      url,
      statusCode: res.status,
      title: extract(html, /<title[^>]*>([^<]*)<\/title>/i),
      metaDescription: extract(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i),
      h1: extract(html, /<h1[^>]*>(.*?)<\/h1>/is)?.replace(/<[^>]+>/g, "").trim() ?? null,
      h1Count: (html.match(/<h1[^>]*>/gi) ?? []).length,
      h2Count: (html.match(/<h2[^>]*>/gi) ?? []).length,
      wordCount: html
        ? html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
        : 0,
      noindex: /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["']/i.test(html),
      canonicalUrl: extract(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i),
      hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
      schemaTypes: extractSchemaTypes(html),
      ogTitle: extract(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i),
      ogDescription: extract(html, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i),
      imageCount: images.length,
      imagesMissingAlt,
      internalLinkCount: html ? extractSameDomainLinks(html, url).length : 0,
      phoneNumbers: extractPhoneNumbers(html),
      responseTimeMs,
      fetchError: null,
    };

    return { page, links: html ? extractSameDomainLinks(html, url) : [] };
  } catch (err) {
    return {
      page: {
        url,
        statusCode: 0,
        title: null,
        metaDescription: null,
        h1: null,
        h1Count: 0,
        h2Count: 0,
        wordCount: 0,
        noindex: false,
        canonicalUrl: null,
        hasViewportMeta: false,
        schemaTypes: [],
        ogTitle: null,
        ogDescription: null,
        imageCount: 0,
        imagesMissingAlt: 0,
        internalLinkCount: 0,
        phoneNumbers: [],
        responseTimeMs: Date.now() - startedAt,
        fetchError: err instanceof Error ? err.message : "Unknown fetch error",
      },
      links: [],
    };
  }
}

/** Concurrency-limited BFS crawl of up to MAX_PAGES same-domain pages starting from the homepage. */
async function crawlSite(domain: string): Promise<CrawledPage[]> {
  const rootUrl = domain.endsWith("/") ? domain : `${domain}/`;
  const visited = new Set<string>([rootUrl]);
  let queue: string[] = [rootUrl];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map((url) => fetchAndAnalyzePage(url)));

    for (const { page, links } of results) {
      pages.push(page);
      if (pages.length >= MAX_PAGES) break;
      for (const link of links) {
        if (!visited.has(link)) {
          visited.add(link);
          queue.push(link);
        }
      }
    }
  }

  return pages;
}

async function fetchSiteWideSignals(domain: string) {
  const base = domain.endsWith("/") ? domain.slice(0, -1) : domain;

  const [robotsResult, sitemapResult] = await Promise.allSettled([
    fetchWithTimeout(`${base}/robots.txt`).then(async (r) => ({
      found: r.ok,
      content: r.ok ? (await r.text()).slice(0, 2000) : null,
    })),
    fetchWithTimeout(`${base}/sitemap.xml`).then(async (r) => {
      if (!r.ok) return { found: false, urlCount: null };
      const text = await r.text();
      return { found: true, urlCount: (text.match(/<loc>/gi) ?? []).length };
    }),
  ]);

  return {
    robotsTxt: robotsResult.status === "fulfilled" ? robotsResult.value : { found: false, content: null },
    sitemap: sitemapResult.status === "fulfilled" ? sitemapResult.value : { found: false, urlCount: null },
  };
}

const ISSUES_TOOL = {
  type: "function" as const,
  function: {
    name: "report_issues",
    description: "Report every technical and local SEO issue found across the crawled site.",
    parameters: {
      type: "object" as const,
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["cwv", "broken_link", "page_structure", "indexability", "meta", "local_seo"],
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
  },
};

const BASE_AUDIT_SYSTEM_PROMPT = `You are a senior technical and local SEO auditor reviewing a crawl of a client's website.
Ground every issue strictly in the structured data provided — never invent a page, URL, phone number, or
fact not present in the input. Report every genuine issue you find; do not limit yourself to one issue
per page or per category, and do not skip minor issues just to keep the list short. A real site
typically has many issues across a crawl this size — a thorough audit reflects that.

You'll receive: per-page data (URL, status code, title, meta description, H1/H2 counts, word count,
noindex flag, canonical URL, viewport meta presence, JSON-LD schema @types found, Open Graph title/
description, image count and how many are missing alt text, internal link count, phone numbers found
on the page, response time, and any fetch error) and site-wide data (robots.txt presence/content,
sitemap.xml presence and URL count).

Categorize each issue into exactly one of: cwv, broken_link, page_structure, indexability, meta, local_seo.

- broken_link: status code >= 400, or a fetch error.
- indexability: noindex on a page that should be indexable; robots.txt disallowing pages it shouldn't;
  a missing or clearly incomplete sitemap.xml; a canonical URL that points somewhere unexpected/wrong;
  an unreachable page.
- meta: missing, duplicate (compare titles/descriptions across pages), or poorly-sized title or meta
  description; missing Open Graph title/description on pages likely to be shared.
- page_structure: missing H1, multiple H1s on one page, missing viewport meta (mobile-friendliness),
  thin content for what looks like a substantive page, images missing alt text, broken heading hierarchy
  (e.g. H2s with no H1).
- local_seo: missing or incomplete LocalBusiness/Organization/Product structured data; NAP (name/
  address/phone) inconsistency — compare the phone numbers found across all pages and flag it if more
  than one distinct number appears (list the differing numbers and the pages they're on); location or
  service pages that look like near-duplicates of each other (very similar word count and structure with
  little unique content); a location/service page with no phone number or way to contact; missing
  internal links between related location/service pages; titles/meta that don't reflect the business's
  location or service area when they plausibly should.
- cwv: response time is notably slow (over ~2s).

Assign severity by real-world impact: critical for 5xx/unreachable pages, sitewide noindex, or a fully
missing sitemap/robots.txt; high for 4xx, NAP inconsistency, missing structured data on what looks like
the homepage or a key location page, or missing viewport meta; medium/low for smaller issues like a
slightly long title, moderately thin content, or a handful of images missing alt text.`;

interface ParsedIssue {
  category: string;
  severity: string;
  url: string;
  description: string;
}

async function analyzeWithOpenRouter(
  pages: CrawledPage[],
  siteSignals: Awaited<ReturnType<typeof fetchSiteWideSignals>>,
  client: { name: string; brand: string; domain: string; customAuditInstructions: string | null },
  model: string,
): Promise<ParsedIssue[]> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured for this project's Edge Functions.");
  }

  const systemPrompt = client.customAuditInstructions
    ? `${BASE_AUDIT_SYSTEM_PROMPT}\n\nAdditional instructions specific to this client:\n${client.customAuditInstructions}`
    : BASE_AUDIT_SYSTEM_PROMPT;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "SEO Automation Dashboard",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Client: ${client.name} (${client.brand}), ${client.domain}\n\nSite-wide signals:\n${JSON.stringify(
            siteSignals,
            null,
            2,
          )}\n\nCrawled page data (${pages.length} pages):\n\n${JSON.stringify(pages, null, 2)}`,
        },
      ],
      tools: [ISSUES_TOOL],
      tool_choice: { type: "function", function: { name: "report_issues" } },
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${res.status}): ${raw || "no error body"}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("The model didn't return a structured issues report.");
  }

  let parsed: { issues?: ParsedIssue[] };
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error("The model's response wasn't valid JSON.");
  }
  return parsed.issues ?? [];
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

  const { auditId, clientId, domain, model: requestedModel } = payload;

  try {
    const model = requestedModel || Deno.env.get("OPENROUTER_MODEL");
    if (!model) {
      throw new Error(
        "No model specified and OPENROUTER_MODEL is not configured for this project's Edge Functions.",
      );
    }

    await supabase.from("audits").update({ status: "crawling", model }).eq("id", auditId);

    const { data: clientRow } = await supabase
      .from("clients")
      .select("name, brand, domain, custom_audit_instructions")
      .eq("id", clientId)
      .single();
    if (!clientRow) throw new Error("Client not found.");

    const [pages, siteSignals] = await Promise.all([crawlSite(domain), fetchSiteWideSignals(domain)]);

    await supabase.from("audits").update({ status: "analyzing" }).eq("id", auditId);

    const issues = await analyzeWithOpenRouter(
      pages,
      siteSignals,
      {
        name: clientRow.name,
        brand: clientRow.brand,
        domain: clientRow.domain,
        customAuditInstructions: clientRow.custom_audit_instructions,
      },
      model,
    );

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
