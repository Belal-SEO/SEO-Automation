import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapAudit, mapClient, mapIssue, mapMetricSnapshot, mapReport } from "@/lib/queries";
import { mapBaseline } from "@/lib/monthlyReportQueries";
import { computeSprintTaskCompletion } from "@/lib/clientStage";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditTriggerButton } from "@/components/crawler/AuditTriggerButton";
import { GenerateReportButton } from "@/components/crawler/GenerateReportButton";
import { CrawlStatusBanner } from "@/components/crawler/CrawlStatusBanner";
import { IssueTable } from "@/components/crawler/IssueTable";
import { IssueFilters } from "@/components/crawler/IssueFilters";
import { CompletedTasksHistory } from "@/components/crawler/CompletedTasksHistory";
import { CWVTrendChart } from "@/components/crawler/CWVTrendChart";
import { BeforeAfterGallery } from "@/components/crawler/BeforeAfterGallery";
import { NotificationSettings } from "@/components/crawler/NotificationSettings";
import { AuditInstructionsSettings } from "@/components/crawler/AuditInstructionsSettings";
import { WpRemoteSecurityPanel } from "@/components/crawler/WpRemoteSecurityPanel";
import { SprintStatusPanel } from "@/components/crawler/SprintStatusPanel";
import { SprintTasksBoard } from "@/components/crawler/SprintTasksBoard";
import { BaselineSummaryCard } from "@/components/crawler/BaselineSummaryCard";
import { ImportReportPanel } from "@/components/crawler/ImportReportPanel";
import { EmptyState } from "@/components/crawler/EmptyState";
import { formatDate, cn } from "@/lib/utils";
import type { Issue } from "@/lib/types";

export const dynamic = "force-dynamic";

const ISSUES_PAGE_SIZE = 20;
const UNASSIGNED = "__unassigned__";

function buildIssuesHref(
  clientId: string,
  searchParams: Record<string, string | undefined>,
  overrides: Record<string, string>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    params.set(key, value);
  }
  return `/clients/${clientId}?${params.toString()}`;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: {
    issuesPage?: string;
    issuesSeverity?: string;
    issuesCategory?: string;
    issuesStatus?: string;
    issuesAssignee?: string;
  };
}) {
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
  const role = await getCurrentTeamRole(supabase);
  const isAdmin = role === "admin";

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

  const issuesPage = Math.max(1, parseInt(searchParams.issuesPage ?? "1", 10) || 1);
  const issuesSeverity = searchParams.issuesSeverity ?? "all";
  const issuesCategory = searchParams.issuesCategory ?? "all";
  const issuesStatus = searchParams.issuesStatus ?? "all";
  const issuesAssignee = searchParams.issuesAssignee ?? "all";

  const [
    { data: sprintTaskRows },
    { data: metricRows },
    sprintCompletion,
    { data: settingsRow },
    { data: baselineRow },
  ] = await Promise.all([
    // Manually-added tasks get their own board (below) -- keep them out of the
    // crawl Issues table (fetched separately, paginated) so they don't show twice.
    auditIds.length > 0
      ? supabase.from("issues").select("*").in("audit_id", auditIds).eq("category", "sprint_task")
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("metric_snapshots")
      .select("*")
      .eq("client_id", client.id)
      .order("captured_at", { ascending: true }),
    isNew ? computeSprintTaskCompletion(supabase, client.id) : Promise.resolve(null),
    isNew && isAdmin
      ? supabase.from("monthly_report_settings").select("gsc_site_url").eq("client_id", client.id).maybeSingle()
      : Promise.resolve({ data: null }),
    isNew && isAdmin
      ? supabase.from("baselines").select("*").eq("client_id", client.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const metricSnapshots = (metricRows ?? []).map(mapMetricSnapshot);
  const baseline = baselineRow ? mapBaseline(baselineRow) : null;
  const sprintTasks = (sprintTaskRows ?? [])
    .map(mapIssue)
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  // Crawl-detected issues (everything except manual sprint tasks) -- paginated
  // server-side since a client with a lot of WP Remote findings can run into
  // the hundreds, which was slow to load and filter entirely client-side.
  let crawlIssues: Issue[] = [];
  let crawlIssuesTotal = 0;
  let crawlAssigneeOptions: string[] = [];
  let completedCrawlIssues: Issue[] = [];

  if (!isNew && auditIds.length > 0) {
    let activeQuery = supabase
      .from("issues")
      .select("*", { count: "exact" })
      .in("audit_id", auditIds)
      .neq("category", "sprint_task")
      .neq("status", "fixed");

    if (issuesSeverity !== "all") activeQuery = activeQuery.eq("severity", issuesSeverity);
    if (issuesCategory !== "all") activeQuery = activeQuery.eq("category", issuesCategory);
    if (issuesStatus !== "all") activeQuery = activeQuery.eq("status", issuesStatus);
    if (issuesAssignee === UNASSIGNED) activeQuery = activeQuery.is("assigned_to", null);
    else if (issuesAssignee !== "all") activeQuery = activeQuery.eq("assigned_to", issuesAssignee);

    const from = (issuesPage - 1) * ISSUES_PAGE_SIZE;
    const to = from + ISSUES_PAGE_SIZE - 1;
    const { data: activeRows, count } = await activeQuery.order("detected_at", { ascending: false }).range(from, to);
    crawlIssues = (activeRows ?? []).map(mapIssue);
    crawlIssuesTotal = count ?? 0;

    const [{ data: assigneeRows }, { data: completedRows }] = await Promise.all([
      supabase
        .from("issues")
        .select("assigned_to")
        .in("audit_id", auditIds)
        .neq("category", "sprint_task")
        .neq("status", "fixed")
        .not("assigned_to", "is", null),
      supabase
        .from("issues")
        .select("*")
        .in("audit_id", auditIds)
        .neq("category", "sprint_task")
        .eq("status", "fixed")
        .order("fixed_at", { ascending: false })
        .limit(50),
    ]);

    crawlAssigneeOptions = Array.from(new Set((assigneeRows ?? []).map((r) => r.assigned_to as string))).sort(
      (a, b) => a.localeCompare(b),
    );
    completedCrawlIssues = (completedRows ?? []).map(mapIssue);
  }

  const crawlIssuesTotalPages = Math.max(1, Math.ceil(crawlIssuesTotal / ISSUES_PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{client.brand}</h1>
          <p className="text-sm text-muted-foreground">
            {client.name} · {client.domain} · {client.locations.join(", ") || "No locations set"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
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
        )}
      </div>

      {isAdmin && isNew && sprintCompletion && (
        <Card>
          <CardContent className="p-4">
            <SprintStatusPanel client={client} completion={sprintCompletion} />
          </CardContent>
        </Card>
      )}

      {isAdmin && isNew && (
        <BaselineSummaryCard clientId={client.id} gscSiteUrl={settingsRow?.gsc_site_url ?? null} baseline={baseline} />
      )}

      {isAdmin && !isNew && inProgressAudit && (
        <CrawlStatusBanner status={inProgressAudit.status} error={inProgressAudit.error} />
      )}
      {isAdmin && !isNew && latestAudit?.status === "failed" && (
        <CrawlStatusBanner status="failed" error={latestAudit.error} />
      )}

      {isNew ? (
        <Card>
          <CardHeader>
            <CardTitle>Sprint tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <SprintTasksBoard
              clientId={client.id}
              clientDomain={client.domain}
              tasks={sprintTasks}
              canManagePriority={isAdmin}
              canDelete={isAdmin}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Core Web Vitals trend</CardTitle>
              </CardHeader>
              <CardContent>
                <CWVTrendChart snapshots={metricSnapshots} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                Issues
                {latestAudit
                  ? ` — latest audit (${formatDate(latestAudit.runAt)}${latestAudit.model ? ` · ${latestAudit.model}` : ""})`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {audits.length === 0 ? (
                <EmptyState
                  title="No audits yet"
                  description="Connect a crawl source and run the first audit to see issues here."
                />
              ) : (
                <div className="space-y-3">
                  <IssueFilters assigneeOptions={crawlAssigneeOptions} totalCount={crawlIssuesTotal} />

                  {crawlIssues.length === 0 ? (
                    <EmptyState title="No matching issues" description="Try a different filter." />
                  ) : (
                    <>
                      <IssueTable
                        issues={crawlIssues}
                        canManagePriority={isAdmin}
                        canManageDueDate={isAdmin}
                        canDelete={isAdmin}
                      />
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link
                          href={buildIssuesHref(client.id, searchParams, {
                            issuesPage: String(Math.max(1, issuesPage - 1)),
                          })}
                          aria-disabled={issuesPage <= 1}
                          className={cn(
                            "rounded-md border border-border px-3 py-1.5 text-sm",
                            issuesPage <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted",
                          )}
                        >
                          Previous
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          Page {issuesPage} of {crawlIssuesTotalPages}
                        </span>
                        <Link
                          href={buildIssuesHref(client.id, searchParams, {
                            issuesPage: String(Math.min(crawlIssuesTotalPages, issuesPage + 1)),
                          })}
                          aria-disabled={issuesPage >= crawlIssuesTotalPages}
                          className={cn(
                            "rounded-md border border-border px-3 py-1.5 text-sm",
                            issuesPage >= crawlIssuesTotalPages ? "pointer-events-none opacity-50" : "hover:bg-muted",
                          )}
                        >
                          Next
                        </Link>
                      </div>
                    </>
                  )}

                  <div className="space-y-3 border-t border-border pt-6">
                    <h3 className="text-sm font-semibold">Completed issues</h3>
                    <CompletedTasksHistory tasks={completedCrawlIssues} showCategory />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <SprintTasksBoard
                clientId={client.id}
                clientDomain={client.domain}
                tasks={sprintTasks}
                canManagePriority={isAdmin}
                canDelete={isAdmin}
              />
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Before / after</CardTitle>
              </CardHeader>
              <CardContent>
                <BeforeAfterGallery issues={completedCrawlIssues} />
              </CardContent>
            </Card>
          )}

          {isAdmin && (
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
          )}
        </>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Import tasks from text</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportReportPanel clientId={client.id} clientDomain={client.domain} isNew={isNew} />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>WP Remote security</CardTitle>
          </CardHeader>
          <CardContent>
            <WpRemoteSecurityPanel client={client} lastSync={wpRemoteAudit} />
          </CardContent>
        </Card>
      )}

      {isAdmin && !isNew && (
        <Card>
          <CardHeader>
            <CardTitle>Audit instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditInstructionsSettings client={client} />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Alert settings</CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationSettings client={client} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
