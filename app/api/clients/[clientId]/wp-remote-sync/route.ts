import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapClient } from "@/lib/queries";
import { fetchWpRemoteSites } from "@/lib/wpRemote";
import { syncClientSecurity } from "@/lib/wpRemoteSync";

/** Pulls this client's current WP Remote security findings (malware, vulnerabilities, outdated software). */
export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  try {
    const supabase = createServiceRoleClient();
    const { data: clientRow, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", params.clientId)
      .maybeSingle();
    if (error) throw error;
    if (!clientRow) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const client = mapClient(clientRow);
    const sites = await fetchWpRemoteSites();
    const result = await syncClientSecurity(supabase, client, sites);

    if (!result.matched) {
      const overrideNote = client.wpRemoteSiteId
        ? ` The site ID field is set to "${client.wpRemoteSiteId}", which also didn't match any WP Remote site by ID or URL.`
        : "";
      return NextResponse.json(
        {
          error: `No WP Remote site found matching ${client.domain}.${overrideNote} Check that the site is added in WP Remote under this exact domain, or paste its URL into the site ID field below.`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
