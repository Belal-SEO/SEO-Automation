import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QuarterlyMeetingsSection } from "@/components/crawler/QuarterlyMeetingsSection";
import { TriageClientsColumn } from "@/components/crawler/TriageClientsColumn";
import type { QuarterlyMeetingItem } from "@/lib/calendarMeetings";
import type { TriageClient } from "@/lib/types";

export function UpcomingMeetingsCard({
  thisWeek,
  nextWeek,
  error,
  triageClients,
}: {
  thisWeek: QuarterlyMeetingItem[];
  nextWeek: QuarterlyMeetingItem[];
  error?: string | null;
  triageClients: TriageClient[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quarterly client meetings</CardTitle>
        <CardDescription>From the shared Google Calendar, plus clients you add manually.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          <QuarterlyMeetingsSection thisWeek={thisWeek} nextWeek={nextWeek} error={error} />
          <TriageClientsColumn clients={triageClients} />
        </div>
      </CardContent>
    </Card>
  );
}
