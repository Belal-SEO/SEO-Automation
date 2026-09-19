import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapClient } from "@/lib/queries";
import { fetchWpRemoteSites } from "@/lib/wpRemote";
import { syncClientSecurity } from "@/lib/wpRemoteSync";

/**
 * Scheduled entry point (see vercel.json) for the daily WP Remote security
 * sync. Fetches the site list once, then syncs every active client that
 * either has a manual site ID set or whose domain matches a WP Remote site
 * -- clients with neither are skipped, not errored, since they simply
 * aren't monitored by WP Remote.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: clientRows, error } = await supabase.from("clients").select("*").eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sites;
  try {
    sites = await fetchWpRemoteSites();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list WP Remote sites." },
      { status: 500 },
    );
  }

  const synced: { clientId: string; brand: string; newCount: number; resolvedCount: number }[] = [];
  const skipped: string[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const row of clientRows ?? []) {
    const client = mapClient(row);
    try {
      const result = await syncClientSecurity(supabase, client, sites);
      if (!result.matched) {
        skipped.push(client.id);
        continue;
      }
      synced.push({ clientId: client.id, brand: client.brand, newCount: result.newCount, resolvedCount: result.resolvedCount });
    } catch (err) {
      failed.push({ clientId: client.id, error: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  return NextResponse.json({ synced, skipped, failed });
}
