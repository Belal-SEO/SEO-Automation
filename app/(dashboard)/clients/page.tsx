import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchClientRoster, fetchOpenIssueSeveritySummary } from "@/lib/queries";
import { fetchSprintTaskCompletionByClient } from "@/lib/clientStage";
import { ClientRosterTable } from "@/components/crawler/ClientRosterTable";
import { NewClientSprintTable } from "@/components/crawler/NewClientSprintTable";
import { ClientForm } from "@/components/crawler/ClientForm";
import { EmptyState } from "@/components/crawler/EmptyState";
import { OverviewSummaryCard } from "@/components/crawler/OverviewSummaryCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const roster = await fetchClientRoster(supabase);
  const issueSummary = await fetchOpenIssueSeveritySummary(
    supabase,
    roster.map((c) => c.id),
  );

  const newClients = roster.filter((c) => c.stage === "new");
  const legacyClients = roster.filter((c) => c.stage === "legacy");
  const completionByClient = await fetchSprintTaskCompletionByClient(
    supabase,
    newClients.map((c) => c.id),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Client roster</h1>
        <p className="text-sm text-muted-foreground">
          Who&apos;s due for a crawl, who has open issues, and who&apos;s waiting on a report.
        </p>
      </div>

      <OverviewSummaryCard summary={issueSummary} />

      <Card>
        <CardHeader>
          <CardTitle>New clients — 90-day sprint</CardTitle>
          <CardDescription>
            Manual tasks + Monthly Reports (GSC, baseline). Graduates to Legacy automatically once the sprint
            deadline passes and every assigned task is done — extend the deadline or move a client over any
            time otherwise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {newClients.length === 0 ? (
            <EmptyState
              title="No new clients"
              description="Add a client with type “New” to start a 90-day sprint."
            />
          ) : (
            <NewClientSprintTable clients={newClients} completionByClient={completionByClient} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy clients</CardTitle>
          <CardDescription>Ongoing crawl audits, technical issues, and reports.</CardDescription>
        </CardHeader>
        <CardContent>
          {legacyClients.length === 0 ? (
            <EmptyState title="No legacy clients" description="Clients that finish their sprint land here." />
          ) : (
            <ClientRosterTable clients={legacyClients} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a client</CardTitle>
          <CardDescription>Reconcile brand and locations against the master client DB.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
