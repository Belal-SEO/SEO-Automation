-- Monthly Reporting Phase 2: Sheets backlinks pull, GBP posts pull,
-- auto-drafted client email, daily cron review reminder.

-- ---------------------------------------------------------------------------
-- settings: add Sheets + GBP bindings
-- ---------------------------------------------------------------------------
alter table public.monthly_report_settings add column if not exists backlinks_sheet_id text;
alter table public.monthly_report_settings add column if not exists backlinks_sheet_tab text;
alter table public.monthly_report_settings add column if not exists gbp_location_id text;

-- ---------------------------------------------------------------------------
-- reports: track whether the review reminder already fired (idempotency)
-- ---------------------------------------------------------------------------
alter table public.monthly_reports add column if not exists reminder_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- tasks: distinguish sheet-seeded rows from manual ones, so a Sheets refresh
-- can resync its own rows without clobbering anything the operator typed
-- ---------------------------------------------------------------------------
alter table public.monthly_report_tasks add column if not exists source text not null default 'manual'
  check (source in ('manual', 'sheet'));

-- ---------------------------------------------------------------------------
-- email drafts (one per report)
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_report_email_drafts (
  id uuid primary key default gen_random_uuid(),
  monthly_report_id uuid not null unique references public.monthly_reports (id) on delete cascade,
  to_email text,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved')),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists monthly_report_email_drafts_set_updated_at on public.monthly_report_email_drafts;
create trigger monthly_report_email_drafts_set_updated_at
  before update on public.monthly_report_email_drafts
  for each row execute function public.set_updated_at();

alter table public.monthly_report_email_drafts enable row level security;

create policy "team_read_monthly_report_email_drafts" on public.monthly_report_email_drafts
  for select to authenticated using (true);
create policy "team_write_monthly_report_email_drafts" on public.monthly_report_email_drafts
  for insert to authenticated with check (true);
create policy "team_update_monthly_report_email_drafts" on public.monthly_report_email_drafts
  for update to authenticated using (true) with check (true);
