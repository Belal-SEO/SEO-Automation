import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Client,
  ClientRosterRow,
  Audit,
  Issue,
  IssueActivity,
  MetricSnapshot,
  Report,
} from "@/lib/types";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export function mapClient(row: Row<"clients">): Client {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    locations: row.locations,
    domain: row.domain,
    cmsType: row.cms_type as Client["cmsType"],
    reportCadenceDays: row.report_cadence_days,
    criticalAlertThreshold: row.critical_alert_threshold,
    customAuditInstructions: row.custom_audit_instructions,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAudit(row: Row<"audits">): Audit {
  return {
    id: row.id,
    clientId: row.client_id,
    runAt: row.run_at,
    source: row.source as Audit["source"],
    status: row.status as Audit["status"],
    error: row.error,
  };
}

export function mapIssue(row: Row<"issues">): Issue {
  return {
    id: row.id,
    auditId: row.audit_id,
    clientId: row.client_id,
    category: row.category as Issue["category"],
    severity: row.severity as Issue["severity"],
    url: row.url,
    description: row.description,
    status: row.status as Issue["status"],
    detectedAt: row.detected_at,
    fixedAt: row.fixed_at,
    beforeScreenshotUrl: row.before_screenshot_url,
    afterScreenshotUrl: row.after_screenshot_url,
    isExecutable: row.is_executable,
    executableAddedAt: row.executable_added_at,
  };
}

export function mapIssueActivity(row: Row<"issue_activity">): IssueActivity {
  return {
    id: row.id,
    issueId: row.issue_id,
    clientId: row.client_id,
    activityType: row.activity_type as IssueActivity["activityType"],
    note: row.note,
    newStatus: row.new_status as IssueActivity["newStatus"],
    createdAt: row.created_at,
  };
}

export function mapMetricSnapshot(row: Row<"metric_snapshots">): MetricSnapshot {
  return {
    id: row.id,
    clientId: row.client_id,
    auditId: row.audit_id,
    metric: row.metric as MetricSnapshot["metric"],
    value: row.value,
    capturedAt: row.captured_at,
  };
}

export function mapReport(row: Row<"reports">): Report {
  return {
    id: row.id,
    clientId: row.client_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    auditIds: row.audit_ids,
    status: row.status as Report["status"],
    content: row.content,
    sentVia: row.sent_via as Report["sentVia"],
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

/** Builds roster rows (last audit, open issue count, report status incl. overdue) for the client list. */
export async function fetchClientRoster(
  supabase: SupabaseClient<Database>,
): Promise<ClientRosterRow[]> {
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("active", true)
    .order("brand", { ascending: true });
  if (clientsError) throw clientsError;
  if (!clients || clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  const [{ data: audits }, { data: openIssues }, { data: reports }] = await Promise.all([
    supabase
      .from("audits")
      .select("client_id, run_at")
      .in("client_id", clientIds)
      .eq("status", "complete")
      .order("run_at", { ascending: false }),
    supabase.from("issues").select("client_id").in("client_id", clientIds).eq("status", "open"),
    supabase
      .from("reports")
      .select("client_id, status, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false }),
  ]);

  const lastAuditByClient = new Map<string, string>();
  for (const a of audits ?? []) {
    if (!lastAuditByClient.has(a.client_id)) lastAuditByClient.set(a.client_id, a.run_at);
  }

  const openIssueCountByClient = new Map<string, number>();
  for (const i of openIssues ?? []) {
    openIssueCountByClient.set(i.client_id, (openIssueCountByClient.get(i.client_id) ?? 0) + 1);
  }

  const latestReportByClient = new Map<string, { status: string; created_at: string }>();
  for (const r of reports ?? []) {
    if (!latestReportByClient.has(r.client_id)) {
      latestReportByClient.set(r.client_id, { status: r.status, created_at: r.created_at });
    }
  }

  return clients.map((row) => {
    const client = mapClient(row);
    const latestReport = latestReportByClient.get(client.id);
    const cadenceMs = client.reportCadenceDays * 24 * 60 * 60 * 1000;
    const isOverdue =
      !latestReport ||
      (latestReport.status !== "sent" &&
        Date.now() - new Date(latestReport.created_at).getTime() > cadenceMs);

    return {
      ...client,
      lastAuditAt: lastAuditByClient.get(client.id) ?? null,
      openIssueCount: openIssueCountByClient.get(client.id) ?? 0,
      latestReportStatus: isOverdue
        ? "overdue"
        : ((latestReport?.status as ClientRosterRow["latestReportStatus"]) ?? "none"),
    };
  });
}
