import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { getGscOAuthClient } from "@/lib/gscAuth";

export interface GscTotals {
  impressions: number;
  clicks: number;
}

/**
 * Pulls aggregate impressions/clicks for a date range from Search Console,
 * via the dedicated GSC connection (see lib/gscAuth.ts) -- throws if it
 * isn't connected yet, and the caller should fall back to manual entry,
 * never block the report.
 */
export async function fetchGscTotals(
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscTotals> {
  const auth = await getGscOAuthClient();
  const webmasters = google.webmasters({ version: "v3", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: [],
    },
  });

  const row = res.data.rows?.[0];
  return {
    impressions: row?.impressions ?? 0,
    clicks: row?.clicks ?? 0,
  };
}

export interface GscTrendPoint {
  date: string;
  clicks: number;
  impressions: number;
}

/** Daily clicks/impressions for a date range, for a trend chart. */
export async function fetchGscTrend(siteUrl: string, startDate: string, endDate: string): Promise<GscTrendPoint[]> {
  const auth = await getGscOAuthClient();
  const webmasters = google.webmasters({ version: "v3", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate, dimensions: ["date"] },
  });

  return (res.data.rows ?? [])
    .map((row) => ({
      date: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
    }))
    .filter((point) => point.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface GscTopItem {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function fetchGscTop(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimension: "query" | "page",
  limit: number,
): Promise<GscTopItem[]> {
  const auth = await getGscOAuthClient();
  const webmasters = google.webmasters({ version: "v3", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: limit,
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    label: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/** Top search queries by clicks for a date range. */
export function fetchGscTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit = 10,
): Promise<GscTopItem[]> {
  return fetchGscTop(siteUrl, startDate, endDate, "query", limit);
}

/** Top landing pages by clicks for a date range. */
export function fetchGscTopPages(
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit = 10,
): Promise<GscTopItem[]> {
  return fetchGscTop(siteUrl, startDate, endDate, "page", limit);
}

export interface GscSitemapInfo {
  submitted: boolean;
  pageCount: number;
}

/**
 * Whether any sitemap is submitted, and total URLs across all submitted
 * sitemaps' `contents[].submitted` counts. Deliberately does NOT use
 * `contents[].indexed` -- Google's own API docs mark that field deprecated
 * and it's been reported to sit at 0 for months even on indexed sites.
 */
export async function fetchGscSitemapInfo(siteUrl: string): Promise<GscSitemapInfo> {
  const auth = await getGscOAuthClient();
  const webmasters = google.webmasters({ version: "v3", auth });

  const res = await webmasters.sitemaps.list({ siteUrl });
  const sitemaps = res.data.sitemap ?? [];

  let pageCount = 0;
  for (const sitemap of sitemaps) {
    for (const content of sitemap.contents ?? []) {
      pageCount += Number(content.submitted ?? 0);
    }
  }

  return { submitted: sitemaps.length > 0, pageCount };
}

export interface BacklinkItem {
  source: string;
  target: string;
}

export interface SheetBacklinksResult {
  count: number;
  items: BacklinkItem[];
}

/**
 * Reads the authority-building Sheet tab and returns rows created within the
 * report period. Assumed column contract (row 1 = header, skipped):
 *   A = Source URL, B = Target URL, C = Date Created (YYYY-MM-DD or any
 *   Date.parse-able format).
 * If column C is missing or unparseable for a row, that row is still
 * counted (best-effort) rather than silently dropped -- adjust here if your
 * sheet uses a different layout.
 */
export async function fetchSheetBacklinks(
  sheetId: string,
  tab: string,
  startDate: string,
  endDate: string,
): Promise<SheetBacklinksResult> {
  const auth = getOAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A2:C`,
  });

  const rows = res.data.values ?? [];
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59Z`).getTime();

  const items: BacklinkItem[] = [];
  for (const row of rows) {
    const [source, target, dateCreated] = row;
    if (!source || !target) continue;

    if (dateCreated) {
      const parsed = new Date(dateCreated).getTime();
      if (!Number.isNaN(parsed) && (parsed < start || parsed > end)) continue;
    }

    items.push({ source, target });
  }

  return { count: items.length, items };
}

export interface GbpPostsResult {
  count: number;
}

/**
 * Counts Local Posts published in the report period for a GBP location.
 * Uses the My Business API v4 (mybusiness.googleapis.com) -- still the only
 * endpoint that exposes Local Posts even though other GBP resources moved
 * to the newer split APIs. Requires the `business.manage` scope AND Google
 * approval for API access on the connected account (see README); until
 * that's granted this will throw and the caller falls back to manual entry.
 */
export async function fetchGbpPostCount(
  locationId: string,
  startDate: string,
  endDate: string,
): Promise<GbpPostsResult> {
  const auth = getOAuthClient();
  const accessToken = (await auth.getAccessToken()).token;
  if (!accessToken) throw new Error("Could not obtain a Google access token.");

  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59Z`).getTime();

  let count = 0;
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`GBP Local Posts request failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as {
      localPosts?: { createTime?: string }[];
      nextPageToken?: string;
    };

    for (const post of data.localPosts ?? []) {
      if (!post.createTime) continue;
      const created = new Date(post.createTime).getTime();
      if (created >= start && created <= end) count++;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { count };
}
