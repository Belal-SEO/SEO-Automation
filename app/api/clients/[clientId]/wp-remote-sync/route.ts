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
      return NextResponse.json(
        { error: `No matching WP Remote site found for ${client.domain}. Set the site ID manually below.` },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
