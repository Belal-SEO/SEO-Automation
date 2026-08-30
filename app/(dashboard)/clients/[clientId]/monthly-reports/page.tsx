import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapClient } from "@/lib/queries";
import { mapBaseline, mapMonthlyReport, mapMonthlyReportSettings } from "@/lib/monthlyReportQueries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { MonthlyReportSettingsForm } from "@/components/monthlyreport/MonthlyReportSettingsForm";
import { BaselineForm } from "@/components/monthlyreport/BaselineForm";
import { NewMonthlyReportForm } from "@/components/monthlyreport/NewMonthlyReportForm";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientMonthlyReportsPage({ params }: { params: { clientId: string } }) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();

  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!clientRow) notFound();
  const client = mapClient(clientRow);

  const [{ data: settingsRow }, { data: baselineRow }, { data: reportRows }] = await Promise.all([
    supabase.from("monthly_report_settings").select("*").eq("client_id", client.id).maybeSingle(),
    supabase.from("baselines").select("*").eq("client_id", client.id).maybeSingle(),
    supabase
      .from("monthly_reports")
      .select("*")
      .eq("client_id", client.id)
      .order("period_start", { ascending: false }),
  ]);

  const settings = settingsRow ? mapMonthlyReportSettings(settingsRow) : null;
  const baseline = baselineRow ? mapBaseline(baselineRow) : null;
  const reports = (reportRows ?? []).map(mapMonthlyReport);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{client.brand} — Monthly Reports</h1>
        <p className="text-sm text-muted-foreground">{client.domain}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Connect GSC for a live impressions/clicks pull — everything else stays manual for now.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyReportSettingsForm clientId={client.id} settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Baseline</CardTitle>
          <CardDescription>Where this client started — every report&apos;s growth % is measured against this.</CardDescription>
        </CardHeader>
        <CardContent>
          <BaselineForm clientId={client.id} baseline={baseline} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New report</CardTitle>
          <CardDescription>Pick the period this report covers.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewMonthlyReportForm
            clientId={client.id}
            sendDayOfMonth={settings?.sendDayOfMonth ?? 5}
            gscConfigured={Boolean(settings?.gscSiteUrl)}
            sheetConfigured={Boolean(settings?.backlinksSheetId && settings?.backlinksSheetTab)}
            gbpConfigured={Boolean(settings?.gbpLocationId)}
            existingReportCount={reports.length}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState title="No reports yet" description="Create the first one above." />
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <Link
                      href={`/clients/${client.id}/monthly-reports/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.periodLabel}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · scheduled to send{" "}
                      {formatDate(r.scheduledSendDate)}
                    </p>
                  </div>
                  <Badge className="capitalize">{r.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
