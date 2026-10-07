import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuarterlyMeetingsSection } from "@/components/crawler/QuarterlyMeetingsSection";
import { TriageClientsColumn } from "@/components/crawler/TriageClientsColumn";
import type { QuarterlyMeetingItem } from "@/lib/calendarMeetings";
import type { TriageClient } from "@/lib/types";

export function UpcomingMeetingsCard({
  thisWeek,
  nextWeek,
  error,
  triageClients,
  canManage = true,
}: {
  thisWeek: QuarterlyMeetingItem[];
  nextWeek: QuarterlyMeetingItem[];
  error?: string | null;
  triageClients: TriageClient[];
  canManage?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quarterly client meetings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          <QuarterlyMeetingsSection thisWeek={thisWeek} nextWeek={nextWeek} error={error} canManage={canManage} />
          <TriageClientsColumn clients={triageClients} canManage={canManage} />
        </div>
      </CardContent>
    </Card>
  );
}
