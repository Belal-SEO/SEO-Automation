import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapClient, mapIssue } from "@/lib/queries";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import { OverviewBoard } from "@/components/crawler/OverviewBoard";
import { EmptyState } from "@/components/crawler/EmptyState";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const role = await getCurrentTeamRole(supabase);
  const isAdmin = role === "admin";

  const { data: clientRows } = await supabase.from("clients").select("*").eq("active", true).order("brand");
  const clients = (clientRows ?? []).map(mapClient);
  const clientIds = clients.map((c) => c.id);

  const { data: issueRows } =
    clientIds.length > 0
      ? await supabase
          .from("issues")
          .select("*")
          .in("client_id", clientIds)
          .order("detected_at", { ascending: false })
      : { data: [] as never[] };
  const issues = (issueRows ?? []).map(mapIssue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Every issue across every client, in one queue — filter by priority or client, assign it, and track it
          through to done.
        </p>
      </div>

      {issues.length === 0 ? (
        <EmptyState title="No issues yet" description="Run an audit on a client to start surfacing issues here." />
      ) : (
        <OverviewBoard issues={issues} clients={clients} canManagePriority={isAdmin} canDelete={isAdmin} />
      )}
    </div>
  );
}
