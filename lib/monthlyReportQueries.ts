import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Baseline,
  MonthlyReport,
  MonthlyReportEmailDraft,
  MonthlyReportMetric,
  MonthlyReportSettings,
  MonthlyReportStatus,
  MonthlyReportTask,
  MonthlyReportRosterRow,
} from "@/lib/monthlyReportTypes";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export function mapMonthlyReportSettings(row: Row<"monthly_report_settings">): MonthlyReportSettings {
  return {
    clientId: row.client_id,
    agencyLabel: row.agency_label,
    websiteUrl: row.website_url,
    clientEmail: row.client_email,
    gscSiteUrl: row.gsc_site_url,
    backlinksSheetId: row.backlinks_sheet_id,
    backlinksSheetTab: row.backlinks_sheet_tab,
    gbpLocationId: row.gbp_location_id,
    sendDayOfMonth: row.send_day_of_month,
    reviewLeadDays: row.review_lead_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBaseline(row: Row<"baselines">): Baseline {
  return {
    id: row.id,
    clientId: row.client_id,
    organicImpressions: row.organic_impressions,
    organicClicks: row.organic_clicks,
    indexedPages: row.indexed_pages,
    totalBacklinks: row.total_backlinks,
    capturedRangeStart: row.captured_range_start,
    capturedRangeEnd: row.captured_range_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMonthlyReport(row: Row<"monthly_reports">): MonthlyReport {
  return {
    id: row.id,
    clientId: row.client_id,
    periodLabel: row.period_label,
    title: row.title,
    subtitle: row.subtitle,
    accentColor: row.accent_color,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scheduledSendDate: row.scheduled_send_date,
    status: row.status as MonthlyReportStatus,
    sortIndex: row.sort_index,
    generatedAt: row.generated_at,
    sentAt: row.sent_at,
    reminderSentAt: row.reminder_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMonthlyReportMetric(row: Row<"monthly_report_metrics">): MonthlyReportMetric {
  return {
    id: row.id,
    monthlyReportId: row.monthly_report_id,
    key: row.key as MonthlyReportMetric["key"],
    label: row.label,
    sublabel: row.sublabel,
    valueNumber: row.value_number,
    valueText: row.value_text,
    source: row.source as MonthlyReportMetric["source"],
    autoValue: row.auto_value,
    isOverridden: row.is_overridden,
    fetchedAt: row.fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMonthlyReportTask(row: Row<"monthly_report_tasks">): MonthlyReportTask {
  return {
    id: row.id,
    monthlyReportId: row.monthly_report_id,
    listKey: row.list_key as MonthlyReportTask["listKey"],
    text: row.text,
    url: row.url,
    source: row.source as MonthlyReportTask["source"],
    sortIndex: row.sort_index,
    createdAt: row.created_at,
  };
}

export function mapMonthlyReportEmailDraft(row: Row<"monthly_report_email_drafts">): MonthlyReportEmailDraft {
  return {
    id: row.id,
    monthlyReportId: row.monthly_report_id,
    toEmail: row.to_email,
    subject: row.subject,
    body: row.body,
    status: row.status as MonthlyReportEmailDraft["status"],
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

/** Roster of active clients with their Monthly Reporting setup + latest report status. */
export async function fetchMonthlyReportRoster(
  supabase: SupabaseClient<Database>,
): Promise<MonthlyReportRosterRow[]> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, brand")
    .eq("active", true)
    .order("brand", { ascending: true });
  if (error) throw error;
  if (!clients || clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  const [{ data: settingsRows }, { data: baselineRows }, { data: reportRows }] = await Promise.all([
    supabase.from("monthly_report_settings").select("client_id").in("client_id", clientIds),
    supabase.from("baselines").select("client_id").in("client_id", clientIds),
    supabase
      .from("monthly_reports")
      .select("client_id, period_label, status, scheduled_send_date")
      .in("client_id", clientIds)
      .order("period_start", { ascending: false }),
  ]);

  const settingsClientIds = new Set((settingsRows ?? []).map((r) => r.client_id));
  const baselineClientIds = new Set((baselineRows ?? []).map((r) => r.client_id));

  const latestReportByClient = new Map<
    string,
    { period_label: string; status: string; scheduled_send_date: string }
  >();
  for (const r of reportRows ?? []) {
    if (!latestReportByClient.has(r.client_id)) latestReportByClient.set(r.client_id, r);
  }

  return clients.map((c) => {
    const latest = latestReportByClient.get(c.id);
    return {
      clientId: c.id,
      brand: c.brand,
      hasSettings: settingsClientIds.has(c.id),
      hasBaseline: baselineClientIds.has(c.id),
      lastReportPeriodLabel: latest?.period_label ?? null,
      lastReportStatus: (latest?.status as MonthlyReportStatus) ?? null,
      nextScheduledSendDate: latest?.scheduled_send_date ?? null,
    };
  });
}
