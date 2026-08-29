import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";

export interface GscTotals {
  impressions: number;
  clicks: number;
}

/**
 * Pulls aggregate impressions/clicks for a date range from Search Console.
 * Requires the shared Google refresh token to have been granted the
 * `webmasters.readonly` scope (see README) -- otherwise this throws and the
 * caller should fall back to manual entry, never block the report.
 */
export async function fetchGscTotals(
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscTotals> {
  const auth = getOAuthClient();
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
