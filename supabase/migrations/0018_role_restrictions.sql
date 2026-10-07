-- Tighten RLS now that team_members exists. Admin keeps full access.
-- Editor is scoped (in the UI) to the client roster + per-client task
-- boards only -- this migration enforces the same boundary at the DB
-- layer so it holds even if someone bypasses the UI: editors can't touch
-- client records, monthly reports/baselines, the shared Search Console
-- connection, or the agency-wide scheduling cards, and can never change a
-- task's priority or delete one.
--
-- Uses ALTER POLICY on existing policies rather than DROP + CREATE: an
-- editor/CI running this non-interactively can't satisfy the destructive-
-- statement confirmation DROP triggers, and ALTER POLICY changes the same
-- USING/WITH CHECK clause in place.

-- Clients: only admins add or edit client records. (No delete policy
-- existed before this either -- deletes were already DB-blocked.)
alter policy "team_write_clients" on public.clients
  with check (public.current_team_role() = 'admin');
alter policy "team_update_clients" on public.clients
  using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');

-- Audits: editors only ever need the "manual" source row that manually-added
-- tasks attach to (see lib/clientStage.ts getOrCreateManualAuditId) -- never
-- a crawl/PSI/WP Remote audit, which only the admin-only API routes create.
alter policy "team_write_audits" on public.audits
  with check (public.current_team_role() = 'admin' or source = 'manual');

-- Issues: editors may only add manual tasks (sprint_task category) and
-- update status/assignee/notes -- never severity, never delete.
alter policy "team_write_issues" on public.issues
  with check (public.current_team_role() = 'admin' or category = 'sprint_task');

create or replace function public.enforce_issue_severity_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() <> 'admin' and new.severity is distinct from old.severity then
    raise exception 'Only an admin can change a task''s priority.';
  end if;
  return new;
end;
$$;

create trigger issues_severity_lock
  before update on public.issues
  for each row execute function public.enforce_issue_severity_lock();

create policy "admin_delete_issues" on public.issues
  for delete to authenticated using (public.current_team_role() = 'admin');

-- Monthly Reports + baselines: admin-only end to end.
alter policy "team_read_monthly_report_settings" on public.monthly_report_settings
  using (public.current_team_role() = 'admin');
alter policy "team_write_monthly_report_settings" on public.monthly_report_settings
  with check (public.current_team_role() = 'admin');
alter policy "team_update_monthly_report_settings" on public.monthly_report_settings
  using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');

alter policy "team_read_baselines" on public.baselines
  using (public.current_team_role() = 'admin');
alter policy "team_write_baselines" on public.baselines
  with check (public.current_team_role() = 'admin');
alter policy "team_update_baselines" on public.baselines
  using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');

alter policy "team_read_monthly_reports" on public.monthly_reports
  using (public.current_team_role() = 'admin');
alter policy "team_write_monthly_reports" on public.monthly_reports
  with check (public.current_team_role() = 'admin');
alter policy "team_update_monthly_reports" on public.monthly_reports
  using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');

alter policy "team_read_monthly_report_metrics" on public.monthly_report_metrics
  using (public.current_team_role() = 'admin');
alter policy "team_write_monthly_report_metrics" on public.monthly_report_metrics
  with check (public.current_team_role() = 'admin');
alter policy "team_update_monthly_report_metrics" on public.monthly_report_metrics
  using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');

alter policy "team_read_monthly_report_tasks" on public.monthly_report_tasks
  using (public.current_team_role() = 'admin');
alter policy "team_write_monthly_report_tasks" on public.monthly_report_tasks
  with check (public.current_team_role() = 'admin');
alter policy "team_delete_monthly_report_tasks" on public.monthly_report_tasks
  using (public.current_team_role() = 'admin');

alter policy "team_read_monthly_report_email_drafts" on public.monthly_report_email_drafts
  using (public.current_team_role() = 'admin');
alter policy "team_write_monthly_report_email_drafts" on public.monthly_report_email_drafts
  with check (public.current_team_role() = 'admin');
alter policy "team_update_monthly_report_email_drafts" on public.monthly_report_email_drafts
  using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');

-- Search Console connection status: admin-only.
alter policy "team_read_google_oauth_tokens" on public.google_oauth_tokens
  using (public.current_team_role() = 'admin');

-- Agency-wide scheduling cards (Triage clients / Quarterly meetings):
-- admin-only, same as Monthly Reports/Coverage.
alter policy "team_read_triage_clients" on public.triage_clients
  using (public.current_team_role() = 'admin');
alter policy "team_write_triage_clients" on public.triage_clients
  with check (public.current_team_role() = 'admin');
alter policy "team_delete_triage_clients" on public.triage_clients
  using (public.current_team_role() = 'admin');

alter policy "team_read_manual_quarterly_meetings" on public.manual_quarterly_meetings
  using (public.current_team_role() = 'admin');
alter policy "team_write_manual_quarterly_meetings" on public.manual_quarterly_meetings
  with check (public.current_team_role() = 'admin');
alter policy "team_delete_manual_quarterly_meetings" on public.manual_quarterly_meetings
  using (public.current_team_role() = 'admin');
