import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/crawler/EmptyState";
import { formatMeetingDate } from "@/lib/utils";
import type { UpcomingMeeting } from "@/lib/calendarMeetings";

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
}: {
  thisWeek: UpcomingMeeting[];
  nextWeek: UpcomingMeeting[];
  error?: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming client meetings</CardTitle>
        <CardDescription>From the shared Google Calendar.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <EmptyState title="Couldn't load the calendar" description={error} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
