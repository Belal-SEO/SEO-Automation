import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  fetchClientRoster,
  fetchOpenIssueSeveritySummary,
  fetchTriageClients,
  fetchManualQuarterlyMeetings,
} from "@/lib/queries";
import { fetchSprintTaskCompletionByClient } from "@/lib/clientStage";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import { ClientRosterTable } from "@/components/crawler/ClientRosterTable";
import { NewClientSprintTable } from "@/components/crawler/NewClientSprintTable";
import { ClientForm } from "@/components/crawler/ClientForm";
import { EmptyState } from "@/components/crawler/EmptyState";
import { OverviewSummaryCard } from "@/components/crawler/OverviewSummaryCard";
import { GscConnectionCard } from "@/components/crawler/GscConnectionCard";
import { UpcomingMeetingsCard } from "@/components/crawler/UpcomingMeetingsCard";
import { getGscConnectionStatus } from "@/lib/gscAuth";
import {
  fetchMeetingsInRange,
  getWeekRange,
  isQuarterlyMeeting,
  type QuarterlyMeetingItem,
} from "@/lib/calendarMeetings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { gsc_connected?: string; gsc_error?: string };
}) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const role = await getCurrentTeamRole(supabase);
  const isAdmin = role === "admin";
  const roster = await fetchClientRoster(supabase);

  let gscStatus: Awaited<ReturnType<typeof getGscConnectionStatus>> | null = null;
  let issueSummary: Awaited<ReturnType<typeof fetchOpenIssueSeveritySummary>> | null = null;
  let meetingsError: string | null = null;
  let icsUrl: string | undefined;
  let triageClients: Awaited<ReturnType<typeof fetchTriageClients>> = [];
  let thisWeekMeetings: QuarterlyMeetingItem[] = [];
  let nextWeekMeetings: QuarterlyMeetingItem[] = [];

  if (isAdmin) {
    gscStatus = await getGscConnectionStatus();
    issueSummary = await fetchOpenIssueSeveritySummary(
      supabase,
      roster.map((c) => c.id),
    );

    icsUrl = process.env.CLIENT_MEETINGS_ICS_URL;
    triageClients = await fetchTriageClients(supabase);
    const manualMeetings = await fetchManualQuarterlyMeetings(supabase);

    const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(0);
    const { end: nextWeekEnd } = getWeekRange(1);

    let calendarMeetings: QuarterlyMeetingItem[] = [];
    if (icsUrl) {
      try {
        const all = await fetchMeetingsInRange(icsUrl, thisWeekStart, nextWeekEnd);
        calendarMeetings = all.filter((m) => isQuarterlyMeeting(m.summary)).map((m) => ({ ...m, id: null }));
      } catch (err) {
        meetingsError = err instanceof Error ? err.message : "Failed to load the calendar.";
      }
    }

    const manualItems: QuarterlyMeetingItem[] = manualMeetings
      .map((m) => ({
        id: m.id,
        summary: m.clientName,
        start: new Date(`${m.meetingDate}T00:00:00`),
        isFullDay: true,
      }))
      .filter((m) => m.start >= thisWeekStart && m.start < nextWeekEnd);

    const allQuarterlyMeetings = [...calendarMeetings, ...manualItems].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
    thisWeekMeetings = allQuarterlyMeetings.filter((m) => m.start < thisWeekEnd);
    nextWeekMeetings = allQuarterlyMeetings.filter((m) => m.start >= thisWeekEnd);
  }

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

      {searchParams.gsc_connected && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Search Console connected.
        </p>
      )}
      {searchParams.gsc_error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Search Console connection failed: {searchParams.gsc_error}
        </p>
      )}

      {isAdmin && (
        <UpcomingMeetingsCard
          thisWeek={thisWeekMeetings}
          nextWeek={nextWeekMeetings}
          error={icsUrl ? meetingsError : null}
          triageClients={triageClients}
        />
      )}

      {isAdmin && issueSummary && <OverviewSummaryCard summary={issueSummary} />}

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
            <NewClientSprintTable clients={newClients} completionByClient={completionByClient} canEdit={isAdmin} />
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

      {isAdmin && gscStatus && <GscConnectionCard status={gscStatus} />}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Add a client</CardTitle>
            <CardDescription>Reconcile brand and locations against the master client DB.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
