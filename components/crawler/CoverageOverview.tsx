import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientRosterTable } from "@/components/crawler/ClientRosterTable";
import type { ClientRosterRow } from "@/lib/types";

export function CoverageOverview({ clients }: { clients: ClientRosterRow[] }) {
  const total = clients.length;
  const sent = clients.filter((c) => c.latestReportStatus === "sent").length;
  const overdue = clients.filter((c) => c.latestReportStatus === "overdue").length;
  const coveragePct = total === 0 ? 0 : Math.round((sent / total) * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Active clients</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reports sent this cycle</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {sent} <span className="text-sm font-normal text-muted-foreground">({coveragePct}%)</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{overdue}</CardContent>
        </Card>
      </div>

      <ClientRosterTable clients={clients} />
    </div>
  );
}
