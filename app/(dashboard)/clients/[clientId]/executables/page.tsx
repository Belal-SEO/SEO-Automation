import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapClient, mapIssue, mapIssueActivity } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExecutablesBoard } from "@/components/crawler/ExecutablesBoard";
import { ExecutableHistoryTimeline } from "@/components/crawler/ExecutableHistoryTimeline";
import type { Issue } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExecutablesPage({ params }: { params: { clientId: string } }) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();

  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!clientRow) notFound();
  const client = mapClient(clientRow);

  const [{ data: executableRows }, { data: activityRows }] = await Promise.all([
    supabase
      .from("issues")
      .select("*")
      .eq("client_id", client.id)
      .eq("is_executable", true)
      .order("executable_added_at", { ascending: false }),
    supabase
      .from("issue_activity")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const executables = (executableRows ?? []).map(mapIssue);
  const activity = (activityRows ?? []).map(mapIssueActivity);

  // History can reference issues that have since been removed from Executables,
  // so pull in any issue referenced by an activity row that isn't already loaded.
  const missingIssueIds = Array.from(new Set(activity.map((a) => a.issueId))).filter(
    (id) => !executables.some((i) => i.id === id),
  );
  let referencedIssues: Issue[] = [];
  if (missingIssueIds.length > 0) {
    const { data: extraIssueRows } = await supabase.from("issues").select("*").in("id", missingIssueIds);
    referencedIssues = (extraIssueRows ?? []).map(mapIssue);
  }

  const issuesById = new Map<string, Issue>();
  for (const issue of [...executables, ...referencedIssues]) {
    issuesById.set(issue.id, issue);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{client.brand} — Executables</h1>
        <p className="text-sm text-muted-foreground">
          This cycle&apos;s selected work, with status and notes — plus the full dated history below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active this cycle</CardTitle>
          <CardDescription>
            Add issues from the client&apos;s audit list to start a new item here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExecutablesBoard issues={executables} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>What was done and when, grouped by month.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExecutableHistoryTimeline activity={activity} issuesById={issuesById} />
        </CardContent>
      </Card>
    </div>
  );
}
