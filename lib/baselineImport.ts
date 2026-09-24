import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchGscTotals, fetchGscTopPages, fetchGscSitemapInfo } from "@/lib/googleReporting";
import { mapBaseline } from "@/lib/monthlyReportQueries";
import type { Baseline } from "@/lib/monthlyReportTypes";

/**
 * Pulls impressions/clicks, top 3 pages, and sitemap status/page count from
 * Search Console for the given date range and upserts them into this
 * client's baseline row. Manual-only fields (indexed_pages,
 * generative_engine_appearances, total_backlinks -- none of which Search
 * Console exposes via any API) are left untouched if the row already exists.
 */
export async function importBaselineFromGsc(
  supabase: SupabaseClient<Database>,
  clientId: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<Baseline> {
  const [totals, topPages, sitemapInfo] = await Promise.all([
    fetchGscTotals(siteUrl, startDate, endDate),
    fetchGscTopPages(siteUrl, startDate, endDate, 3),
    fetchGscSitemapInfo(siteUrl),
  ]);

  const { data, error } = await supabase
    .from("baselines")
    .upsert(
      {
        client_id: clientId,
        organic_impressions: totals.impressions,
        organic_clicks: totals.clicks,
        sitemap_submitted: sitemapInfo.submitted,
        sitemap_page_count: sitemapInfo.pageCount,
        top_pages: topPages.map((p) => ({ url: p.label, clicks: p.clicks, impressions: p.impressions })),
        captured_range_start: startDate,
        captured_range_end: endDate,
      },
      { onConflict: "client_id" },
    )
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Failed to save baseline.");
  return mapBaseline(data);
}
