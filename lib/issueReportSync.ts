import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Issue } from "@/lib/types";

/**
 * Mirrors a just-fixed issue into the client's most recent monthly report as
 * an "Issues Fixed" item, so Executables/Overview work doesn't have to be
 * retyped into the report by hand. No-ops if the client has no report yet.
 */
export async function syncFixedIssueToReport(supabase: SupabaseClient<Database>, issue: Issue): Promise<void> {
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("id")
    .eq("client_id", issue.clientId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) return;

  const { count } = await supabase
    .from("monthly_report_tasks")
    .select("id", { count: "exact", head: true })
    .eq("monthly_report_id", report.id)
    .eq("list_key", "issues");

  await supabase.from("monthly_report_tasks").insert({
    monthly_report_id: report.id,
    list_key: "issues",
    text: `${issue.description} (${issue.url})`,
    sort_index: count ?? 0,
  });
}
