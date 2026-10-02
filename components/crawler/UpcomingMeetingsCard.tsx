import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/crawler/EmptyState";
import { TriageClientsColumn } from "@/components/crawler/TriageClientsColumn";
import { formatMeetingDate } from "@/lib/utils";
import type { UpcomingMeeting } from "@/lib/calendarMeetings";
import type { TriageClient } from "@/lib/types";

function MeetingList({ meetings }: { meetings: UpcomingMeeting[] }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-muted-foreground">No meetings scheduled.</p>;
  }
  return (
    <ul className="space-y-2">
      {meetings.map((m, i) => (
        <li key={i} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate font-medium">{m.summary}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatMeetingDate(m.start, m.isFullDay)}</span>
        </li>
      ))}
    </ul>
  );
}

export function UpcomingMeetingsCard({
  thisWeek,
  nextWeek,
  error,
  triageClients,
}: {
  thisWeek: UpcomingMeeting[];
  nextWeek: UpcomingMeeting[];
  error?: string | null;
  triageClients: TriageClient[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming client meetings</CardTitle>
        <CardDescription>From the shared Google Calendar.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          {error ? (
            <div className="sm:col-span-2">
              <EmptyState title="Couldn't load the calendar" description={error} />
            </div>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  This week
                </h3>
                <MeetingList meetings={thisWeek} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Next week
                </h3>
                <MeetingList meetings={nextWeek} />
              </div>
            </>
          )}
          <TriageClientsColumn clients={triageClients} />
        </div>
      </CardContent>
    </Card>
  );
}
