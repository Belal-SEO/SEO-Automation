import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapAudit, mapClient, mapIssue, mapMetricSnapshot, mapReport } from "@/lib/queries";
import { computeSprintTaskCompletion } from "@/lib/clientStage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditTriggerButton } from "@/components/crawler/AuditTriggerButton";
import { GenerateReportButton } from "@/components/crawler/GenerateReportButton";
import { CrawlStatusBanner } from "@/components/crawler/CrawlStatusBanner";
import { IssueTable } from "@/components/crawler/IssueTable";
import { CWVTrendChart } from "@/components/crawler/CWVTrendChart";
import { BeforeAfterGallery } from "@/components/crawler/BeforeAfterGallery";
import { NotificationSettings } from "@/components/crawler/NotificationSettings";
import { AuditInstructionsSettings } from "@/components/crawler/AuditInstructionsSettings";
import { WpRemoteSecurityPanel } from "@/components/crawler/WpRemoteSecurityPanel";
import { SprintStatusPanel } from "@/components/crawler/SprintStatusPanel";
import { SprintTasksBoard } from "@/components/crawler/SprintTasksBoard";
import { ImportReportPanel } from "@/components/crawler/ImportReportPanel";
import { EmptyState } from "@/components/crawler/EmptyState";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();

  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!clientRow) notFound();
  const client = mapClient(clientRow);
  const isNew = client.stage === "new";

  const [{ data: auditRows }, { data: reportRows }] = await Promise.all([
    supabase
      .from("audits")
      .select("*")
      .eq("client_id", client.id)
      .order("run_at", { ascending: false })
      .limit(10),
    supabase
      .from("reports")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const audits = (auditRows ?? []).map(mapAudit);
  const reports = (reportRows ?? []).map(mapReport);
  const crawlAudits = audits.filter((a) => a.source !== "wp_remote");
  const latestAudit = crawlAudits[0] ?? null;
  const wpRemoteAudit = audits.find((a) => a.source === "wp_remote") ?? null;
  const inProgressAudit = crawlAudits.find(
    (a) => a.status === "queued" || a.status === "crawling" || a.status === "analyzing",
  );

  const auditIds = audits.map((a) => a.id);
  const [{ data: issueRows }, { data: metricRows }, sprintCompletion] = await Promise.all([
    auditIds.length > 0
      ? supabase.from("issues").select("*").in("audit_id", auditIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("metric_snapshots")
      .select("*")
      .eq("client_id", client.id)
      .order("captured_at", { ascending: true }),
    isNew ? computeSprintTaskCompletion(supabase, client.id) : Promise.resolve(null),
  ]);

  const issues = (issueRows ?? []).map(mapIssue);
  const metricSnapshots = (metricRows ?? []).map(mapMetricSnapshot);
  const fixedIssues = issues.filter((i) => i.status === "fixed");
  const sprintTasks = issues
    .filter((i) => i.category === "sprint_task")
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{client.brand}</h1>
          <p className="text-sm text-muted-foreground">
            {client.name} · {client.domain} · {client.locations.join(", ") || "No locations set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}/executables`}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Executables
          </Link>
          <Link
            href={`/clients/${client.id}/monthly-reports`}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Monthly Reports
          </Link>
          {!isNew && (
            <>
              <GenerateReportButton clientId={client.id} />
              <AuditTriggerButton clientId={client.id} />
            </>
          )}
        </div>
      </div>

      {isNew && sprintCompletion && (
        <Card>
          <CardContent className="p-4">
            <SprintStatusPanel client={client} completion={sprintCompletion} />
          </CardContent>
        </Card>
      )}

      {!isNew && inProgressAudit && (
        <CrawlStatusBanner status={inProgressAudit.status} error={inProgressAudit.error} />
      )}
      {!isNew && latestAudit?.status === "failed" && (
        <CrawlStatusBanner status="failed" error={latestAudit.error} />
      )}

      {isNew ? (
        <Card>
          <CardHeader>
            <CardTitle>Sprint tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <SprintTasksBoard clientId={client.id} clientDomain={client.domain} tasks={sprintTasks} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals trend</CardTitle>
            </CardHeader>
            <CardContent>
              <CWVTrendChart snapshots={metricSnapshots} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issues {latestAudit ? `— latest audit (${formatDate(latestAudit.runAt)})` : ""}</CardTitle>
            </CardHeader>
            <CardContent>
              {audits.length === 0 ? (
                <EmptyState
                  title="No audits yet"
                  description="Connect a crawl source and run the first audit to see issues here."
                />
              ) : (
                <IssueTable issues={issues} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Before / after</CardTitle>
            </CardHeader>
            <CardContent>
              <BeforeAfterGallery issues={fixedIssues} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <EmptyState title="No reports yet" description="Generate a draft once an audit has completed." />
              ) : (
                <ul className="divide-y divide-border">
                  {reports.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/clients/${client.id}/reports/${r.id}`} className="hover:underline">
                        {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                      </Link>
                      <span className="capitalize text-muted-foreground">{r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import audit report</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportReportPanel clientId={client.id} clientDomain={client.domain} isNew={isNew} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WP Remote security</CardTitle>
        </CardHeader>
        <CardContent>
          <WpRemoteSecurityPanel client={client} lastSync={wpRemoteAudit} />
        </CardContent>
      </Card>

      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle>Audit instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditInstructionsSettings client={client} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Alert settings</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationSettings client={client} />
        </CardContent>
      </Card>
    </div>
  );
}
