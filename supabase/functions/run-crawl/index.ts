// Supabase Edge Function: run-crawl
//
// Triggered by POST /api/crawl ("run now") or the monthly cron. Gathers page
// data for the client's site via one of two crawl sources (selectable per
// run), extracts a broad set of on-page local SEO signals (structured data,
// NAP, canonical/meta/OG tags, image alt coverage, internal linking,
// robots/sitemap coverage) from each page's HTML, then hands all of it to a
// model (selectable per run, routed through OpenRouter -- see
// analyzeWithOpenRouter) to identify and categorize issues. PageSpeed
// Insights stays independent of the crawl since it needs real user /
// Lighthouse data that no page fetch can produce.
//
// Crawl sources:
//   - "self" (default): self-fetched same-domain BFS crawl (plain fetch, no
//     external service or licensed CLI required).
//   - "firecrawl": Firecrawl's hosted crawl API (POST /v1/crawl, poll GET
//     /v1/crawl/{id}) -- handles JS-rendered pages and anti-bot measures our
//     own fetcher can't. Requires FIRECRAWL_API_KEY. Field shapes verified
//     against Firecrawl's own source (apps/api/src/controllers/v1/{crawl,
//     crawl-status}.ts in mendableai/firecrawl) rather than guessed.
//   - "ahrefs": reads findings from an existing Ahrefs Site Audit project
//     (api.ahrefs.com/v3/site-audit) for the client's domain -- this does NOT
//     trigger a new Ahrefs crawl, it reads the most recent one, so a Site
//     Audit project must already exist and be verified for the domain in
//     Ahrefs. Requires AHREFS_API_KEY. NOTE: docs.ahrefs.com is unreachable
//     from this sandbox, so the exact response wrapper key names below
//     ("projects"/"issues"/"pages") are best-effort from indexed doc content,
//     not verified against the live API or source the way Firecrawl's shapes
//     were -- extractAhrefsArray() fails loudly with the raw response body if
//     a key name turns out to be wrong, rather than silently misparsing.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CrawlSource = "self" | "firecrawl" | "ahrefs";

interface RunCrawlPayload {
  auditId: string;
  clientId: string;
  domain: string;
  model?: string;
  crawlSource?: CrawlSource;
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

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SEOAuditAgent/1.0 (+technical-crawl)", ...(init?.headers ?? {}) },
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

/** Pure HTML -> CrawledPage extraction, shared by both crawl sources (self-fetch and Firecrawl) so the analysis is identical either way. */
function analyzePageHtml(
  url: string,
  statusCode: number,
  html: string,
  responseTimeMs: number,
  fetchError: string | null,
): CrawledPage {
  const images = extractAll(html, /<img\s[^>]*>/gi);
  const imagesMissingAlt = images.filter((img) => !/\salt=["'][^"']+["']/i.test(img)).length;

  return {
    url,
    statusCode,
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
    fetchError,
  };
}

async function fetchAndAnalyzePage(url: string): Promise<{ page: CrawledPage; links: string[] }> {
  const startedAt = Date.now();
  try {
    const res = await fetchWithTimeout(url);
    const responseTimeMs = Date.now() - startedAt;
    const isHtml = res.headers.get("content-type")?.includes("text/html");
    const html = isHtml ? await res.text() : "";
    const page = analyzePageHtml(url, res.status, html, responseTimeMs, null);
    return { page, links: html ? extractSameDomainLinks(html, url) : [] };
  } catch (err) {
    return {
      page: analyzePageHtml(
        url,
        0,
        "",
        Date.now() - startedAt,
        err instanceof Error ? err.message : "Unknown fetch error",
      ),
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

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";
const FIRECRAWL_POLL_INTERVAL_MS = 3000;
const FIRECRAWL_TIMEOUT_MS = 120000;

interface FirecrawlDocument {
  rawHtml?: string;
  links?: string[];
  metadata: {
    sourceURL?: string;
    url?: string;
    statusCode: number;
    error?: string;
  };
}

/** Starts a Firecrawl crawl job and polls it to completion, verified against Firecrawl's own source (mendableai/firecrawl apps/api/src/controllers/v1/{crawl,crawl-status}.ts) rather than guessed. */
async function crawlSiteViaFirecrawl(domain: string): Promise<CrawledPage[]> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured for this project's Edge Functions.");
  }

  const rootUrl = domain.endsWith("/") ? domain : `${domain}/`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const startRes = await fetchWithTimeout(`${FIRECRAWL_BASE_URL}/crawl`, FETCH_TIMEOUT_MS, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: rootUrl,
      limit: MAX_PAGES,
      allowExternalLinks: false,
      // onlyMainContent: false -- the extraction below needs the full page
      // (head tags, nav, footer) for canonical/viewport/OG/schema/phone-number
      // signals, not just Firecrawl's readability-trimmed "main content".
      scrapeOptions: { formats: ["rawHtml", "links"], onlyMainContent: false },
    }),
  });

  if (!startRes.ok) {
    const raw = await startRes.text().catch(() => "");
    throw new Error(`Firecrawl crawl request failed (${startRes.status}): ${raw || "no error body"}`);
  }

  const started = (await startRes.json()) as { success: boolean; id?: string; error?: string };
  if (!started.success || !started.id) {
    throw new Error(`Firecrawl didn't start the crawl: ${started.error ?? "no job id returned"}`);
  }

  const startedAt = Date.now();
  let nextUrl: string | null = `${FIRECRAWL_BASE_URL}/crawl/${started.id}`;
  const documents: FirecrawlDocument[] = [];

  while (nextUrl) {
    if (Date.now() - startedAt > FIRECRAWL_TIMEOUT_MS) {
      throw new Error(`Firecrawl crawl timed out after ${FIRECRAWL_TIMEOUT_MS / 1000}s.`);
    }

    const statusRes = await fetchWithTimeout(nextUrl, FETCH_TIMEOUT_MS, { headers });
    if (!statusRes.ok) {
      const raw = await statusRes.text().catch(() => "");
      throw new Error(`Firecrawl status check failed (${statusRes.status}): ${raw || "no error body"}`);
    }

    const statusBody = (await statusRes.json()) as {
      success: boolean;
      status: "scraping" | "completed" | "cancelled" | "failed";
      next?: string;
      data: FirecrawlDocument[];
      error?: string;
    };

    if (statusBody.status === "failed" || statusBody.status === "cancelled") {
      throw new Error(`Firecrawl crawl ${statusBody.status}: ${statusBody.error ?? "no error detail given"}`);
    }

    if (statusBody.status === "completed") {
      // Only collect `data` once completed -- an in-progress response's `data`
      // isn't guaranteed to be empty-until-done vs. growing-each-poll, so
      // collecting on every poll risks counting the same page more than once.
      documents.push(...(statusBody.data ?? []));
      nextUrl = statusBody.next ?? null;
      if (!nextUrl) break;
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, FIRECRAWL_POLL_INTERVAL_MS));
  }

  return documents.map((doc) =>
    analyzePageHtml(
      doc.metadata.sourceURL ?? doc.metadata.url ?? rootUrl,
      doc.metadata.statusCode ?? 0,
      doc.rawHtml ?? "",
      0,
      doc.metadata.error ?? null,
    ),
  );
}

const AHREFS_BASE_URL = "https://api.ahrefs.com/v3/site-audit";
// "Notice"-level issues are too low-signal to turn into tasks.
const AHREFS_RELEVANT_IMPORTANCE = new Set(["Error", "Warning"]);
// Page Explorer has a fixed cost of 50 API units per call, so only the
// highest-impact issues (by affected page count) get per-page detail --
// bounds a single run's Ahrefs unit cost regardless of how many issue types
// come back. Tune up if your plan's unit budget allows more.
const AHREFS_MAX_ISSUES_WITH_PAGES = 8;
const AHREFS_PAGES_PER_ISSUE = 5;

interface AhrefsIssueRow {
  issue_id: number | string;
  name: string;
  category: string;
  importance: string;
  crawled?: number | null;
}

interface AhrefsFinding {
  issueId: number | string;
  name: string;
  category: string;
  importance: string;
  affectedCount: number;
  urls: string[];
}

/** Best-effort unwrap for Ahrefs' resource-keyed response shapes -- see the file-header note on why these key names aren't fully verified. Fails loudly with the raw body rather than silently misparsing. */
function extractAhrefsArray<T>(body: unknown, key: string): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (Array.isArray(record[key])) return record[key] as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  throw new Error(
    `Unexpected Ahrefs response shape (expected a "${key}" array): ${JSON.stringify(body).slice(0, 500)}`,
  );
}

async function ahrefsRequest(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const url = `${AHREFS_BASE_URL}${path}?${new URLSearchParams(params)}`;
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Ahrefs request to ${path} failed (${res.status}): ${raw || "no error body"}`);
  }
  return res.json();
}

/** Resolves the client's Ahrefs Site Audit project by domain, fetches its current issues, and pulls a sample of affected URLs for the highest-impact ones. */
async function fetchAhrefsFindings(domain: string): Promise<AhrefsFinding[]> {
  const apiKey = Deno.env.get("AHREFS_API_KEY");
  if (!apiKey) {
    throw new Error("AHREFS_API_KEY is not configured for this project's Edge Functions.");
  }

  const projectsBody = await ahrefsRequest("/projects", { project_url: domain }, apiKey);
  const projects = extractAhrefsArray<{ project_id: string | number }>(projectsBody, "projects");
  const projectId = projects[0]?.project_id;
  if (!projectId) {
    throw new Error(
      `No Ahrefs Site Audit project found for ${domain}. Create and verify ownership of a Site Audit project for this domain in Ahrefs first.`,
    );
  }

  const issuesBody = await ahrefsRequest("/issues", { project_id: String(projectId) }, apiKey);
  const issueRows = extractAhrefsArray<AhrefsIssueRow>(issuesBody, "issues");

  const relevant = issueRows
    .filter((row) => AHREFS_RELEVANT_IMPORTANCE.has(row.importance) && (row.crawled ?? 0) > 0)
    .sort((a, b) => (b.crawled ?? 0) - (a.crawled ?? 0));

  const withPages = relevant.slice(0, AHREFS_MAX_ISSUES_WITH_PAGES);
  const withoutPages = relevant.slice(AHREFS_MAX_ISSUES_WITH_PAGES);

  const withPagesFindings = await Promise.all(
    withPages.map(async (row): Promise<AhrefsFinding> => {
      const where = JSON.stringify({ field: "issue_id", is: ["eq", row.issue_id] });
      const pagesBody = await ahrefsRequest(
        "/page-explorer",
        { project_id: String(projectId), where, select: "url", limit: String(AHREFS_PAGES_PER_ISSUE) },
        apiKey,
      );
      const pageRows = extractAhrefsArray<{ url: string }>(pagesBody, "pages");
      return {
        issueId: row.issue_id,
        name: row.name,
        category: row.category,
        importance: row.importance,
        affectedCount: row.crawled ?? 0,
        urls: pageRows.map((p) => p.url),
      };
    }),
  );

  const withoutPagesFindings: AhrefsFinding[] = withoutPages.map((row) => ({
    issueId: row.issue_id,
    name: row.name,
    category: row.category,
    importance: row.importance,
    affectedCount: row.crawled ?? 0,
    urls: [],
  }));

  return [...withPagesFindings, ...withoutPagesFindings];
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

interface ExistingIssueSummary {
  category: string;
  url: string;
  description: string;
}

function buildDedupeInstructions(existingIssues: ExistingIssueSummary[]): string {
  return existingIssues.length > 0
    ? `\n\nThese issues are already tracked on this client's task board and open -- do NOT report any of them again, even if worded differently. Only report genuinely new issues not covered by this list:\n${JSON.stringify(existingIssues, null, 2)}`
    : "";
}

/** Calls the model with the report_issues tool forced, and parses its structured response. Shared by both the crawl-based and Ahrefs-findings-based analysis paths -- only the prompt and input data differ between them. */
async function callOpenRouterForIssues(systemPrompt: string, userContent: string, model: string): Promise<ParsedIssue[]> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured for this project's Edge Functions.");
  }

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
        { role: "user", content: userContent },
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

async function analyzeWithOpenRouter(
  pages: CrawledPage[],
  siteSignals: Awaited<ReturnType<typeof fetchSiteWideSignals>>,
  client: { name: string; brand: string; domain: string; customAuditInstructions: string | null },
  model: string,
  existingIssues: ExistingIssueSummary[],
): Promise<ParsedIssue[]> {
  const systemPrompt = `${BASE_AUDIT_SYSTEM_PROMPT}${buildDedupeInstructions(existingIssues)}${
    client.customAuditInstructions
      ? `\n\nAdditional instructions specific to this client:\n${client.customAuditInstructions}`
      : ""
  }`;
  const userContent = `Client: ${client.name} (${client.brand}), ${client.domain}\n\nSite-wide signals:\n${JSON.stringify(
    siteSignals,
    null,
    2,
  )}\n\nCrawled page data (${pages.length} pages):\n\n${JSON.stringify(pages, null, 2)}`;

  return callOpenRouterForIssues(systemPrompt, userContent, model);
}

const AHREFS_AUDIT_SYSTEM_PROMPT = `You are a senior technical SEO auditor reviewing findings pulled from an Ahrefs
Site Audit crawl of a client's website. Ground every issue strictly in the findings provided -- never invent a page,
URL, or fact not present in the input.

Each finding has: an Ahrefs issue name, an Ahrefs category, an importance level (Error or Warning), how many pages
are affected (affectedCount), and (when available) a sample of specific affected page URLs (urls).

For a finding WITH urls listed: report one issue per URL in that list (use that exact URL).
For a finding with an EMPTY urls list (page sampling was skipped for this one to control API cost since it wasn't
among the highest-impact findings): report one sitewide issue using the client's domain as the URL, and mention the
total affectedCount in the description.

Categorize each issue into exactly one of: cwv, broken_link, page_structure, indexability, meta, local_seo. Use this
mapping from Ahrefs' own categories as a guide, adjusting based on the specific issue name when a category could
plausibly fit more than one bucket:
- Indexability, Redirects, Sitemaps -> indexability
- Links, External pages -> broken_link
- Content, Duplicates, Localization, Social tags, AI Discoverability -> meta
- Internal pages, Images, JavaScript, CSS, Usability and performance, Other -> page_structure
- Anything clearly about page load speed or Core Web Vitals -> cwv

Assign severity by real-world impact: critical for a sitewide indexability/redirect failure or an issue affecting
most of the site's pages; high for an "Error"-importance issue affecting a meaningful share of pages; medium for a
"Warning"-importance issue or an "Error" affecting only a handful of pages; low for anything narrower or cosmetic.`;

async function analyzeAhrefsFindings(
  findings: AhrefsFinding[],
  client: { name: string; brand: string; domain: string; customAuditInstructions: string | null },
  model: string,
  existingIssues: ExistingIssueSummary[],
): Promise<ParsedIssue[]> {
  const systemPrompt = `${AHREFS_AUDIT_SYSTEM_PROMPT}${buildDedupeInstructions(existingIssues)}${
    client.customAuditInstructions
      ? `\n\nAdditional instructions specific to this client:\n${client.customAuditInstructions}`
      : ""
  }`;
  const userContent = `Client: ${client.name} (${client.brand}), ${client.domain}\n\nAhrefs Site Audit findings (${findings.length}):\n\n${JSON.stringify(findings, null, 2)}`;

  return callOpenRouterForIssues(systemPrompt, userContent, model);
}

/** Normalizes a URL for duplicate comparison -- ignores a trailing slash and any query/hash. */
function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
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

  const { auditId, clientId, domain, model: requestedModel, crawlSource = "self" } = payload;

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

    const client = {
      name: clientRow.name,
      brand: clientRow.brand,
      domain: clientRow.domain,
      customAuditInstructions: clientRow.custom_audit_instructions,
    };

    // Issues already open on this client's task board, across any source --
    // passed to the model as "don't re-report these" context, and used
    // again below as a hard filter after the model responds.
    const existingIssuesQuery = supabase
      .from("issues")
      .select("category, url, description")
      .eq("client_id", clientId)
      .neq("status", "fixed");

    let analyzed: ParsedIssue[];
    let resultMeta: Record<string, number>;
    let existingIssues: ExistingIssueSummary[];

    if (crawlSource === "ahrefs") {
      const [findings, { data: existingIssueRows }] = await Promise.all([
        fetchAhrefsFindings(domain),
        existingIssuesQuery,
      ]);
      await supabase.from("audits").update({ status: "analyzing" }).eq("id", auditId);

      existingIssues = existingIssueRows ?? [];
      analyzed = findings.length > 0 ? await analyzeAhrefsFindings(findings, client, model, existingIssues) : [];
      resultMeta = { ahrefsFindingsProcessed: findings.length };
    } else {
      const [pages, siteSignals, { data: existingIssueRows }] = await Promise.all([
        crawlSource === "firecrawl" ? crawlSiteViaFirecrawl(domain) : crawlSite(domain),
        fetchSiteWideSignals(domain),
        existingIssuesQuery,
      ]);
      await supabase.from("audits").update({ status: "analyzing" }).eq("id", auditId);

      existingIssues = existingIssueRows ?? [];
      analyzed = await analyzeWithOpenRouter(pages, siteSignals, client, model, existingIssues);
      resultMeta = { pagesCrawled: pages.length };
    }

    const existingKeys = new Set(existingIssues.map((i) => `${i.category}|${normalizeUrlForDedup(i.url)}`));

    // Belt-and-suspenders: even though the prompt tells the model not to
    // re-report tracked issues, still filter out exact category+page matches
    // against what's already open, in case the model repeats one anyway.
    const issues = analyzed.filter(
      (issue) => !existingKeys.has(`${issue.category}|${normalizeUrlForDedup(issue.url)}`),
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

    return new Response(
      JSON.stringify({
        ok: true,
        ...resultMeta,
        issuesFound: issues.length,
        duplicatesSkipped: analyzed.length - issues.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown crawl error.";
    await supabase.from("audits").update({ status: "failed", error: message }).eq("id", auditId);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
