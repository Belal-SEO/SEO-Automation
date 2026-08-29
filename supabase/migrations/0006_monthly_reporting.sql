-- Monthly Reporting: a second pillar tool sharing the existing client
-- roster. Scoped to the PRD's own defined MVP -- baseline, custom-range
-- reports, GSC live pull with manual override, history + trend, PDF/print
-- via browser print. Sheets/GBP pulls, auto-drafted client emails, and the
-- cron review reminder are explicitly Phase 2 (per the PRD's own phasing).
-- No team/multi-tenant layer: this app is already one shared workspace,
-- same as every other table here.

-- ---------------------------------------------------------------------------
-- monthly_report_settings (one row per client, created on first configure)
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_report_settings (
  client_id uuid primary key references public.clients (id) on delete cascade,
  agency_label text,
  website_url text,
  client_email text,
  gsc_site_url text,
  send_day_of_month integer not null default 5 check (send_day_of_month between 1 and 28),
  review_lead_days integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists monthly_report_settings_set_updated_at on public.monthly_report_settings;
create trigger monthly_report_settings_set_updated_at
  before update on public.monthly_report_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- baselines (one row per client)
-- ---------------------------------------------------------------------------
create table if not exists public.baselines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  organic_impressions numeric not null default 0,
  organic_clicks numeric not null default 0,
  indexed_pages numeric not null default 0,
  total_backlinks numeric not null default 0,
  captured_range_start date,
  captured_range_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists baselines_set_updated_at on public.baselines;
create trigger baselines_set_updated_at
  before update on public.baselines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- monthly_reports (one per period per client)
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period_label text not null,
  title text not null default 'Monthly SEO Report',
  subtitle text,
  accent_color text not null default '#0d9488',
  period_start date not null,
  period_end date not null,
  scheduled_send_date date not null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'sent')),
  sort_index integer not null default 0,
  generated_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_reports_period_valid check (period_end >= period_start)
);

create index if not exists monthly_reports_client_id_period_start_idx
  on public.monthly_reports (client_id, period_start desc);

drop trigger if exists monthly_reports_set_updated_at on public.monthly_reports;
create trigger monthly_reports_set_updated_at
  before update on public.monthly_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- monthly_report_metrics (rows, not columns -- arbitrary history + per-metric source)
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_report_metrics (
  id uuid primary key default gen_random_uuid(),
  monthly_report_id uuid not null references public.monthly_reports (id) on delete cascade,
  key text not null check (key in (
    'issues_fixed', 'pages_optimised', 'new_pages', 'backlinks_built', 'blog_posts',
    'impressions', 'clicks', 'pages_indexed', 'gbp_optimised', 'gbp_posts', 'good_leads'
  )),
  label text not null,
  sublabel text,
  value_number numeric,
  value_text text,
  source text not null default 'manual' check (source in ('gsc', 'sheet', 'gbp', 'manual')),
  auto_value numeric,
  is_overridden boolean not null default false,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (monthly_report_id, key)
);

create index if not exists monthly_report_metrics_report_id_idx
  on public.monthly_report_metrics (monthly_report_id);

drop trigger if exists monthly_report_metrics_set_updated_at on public.monthly_report_metrics;
create trigger monthly_report_metrics_set_updated_at
  before update on public.monthly_report_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- monthly_report_tasks (the "what we did" detail lists)
-- ---------------------------------------------------------------------------
create table if not exists public.monthly_report_tasks (
  id uuid primary key default gen_random_uuid(),
  monthly_report_id uuid not null references public.monthly_reports (id) on delete cascade,
  list_key text not null check (list_key in (
    'issues', 'pages_optimised', 'new_pages', 'backlinks', 'blog_posts', 'cro', 'notes'
  )),
  text text not null,
  url text,
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists monthly_report_tasks_report_id_idx
  on public.monthly_report_tasks (monthly_report_id, list_key);

-- ---------------------------------------------------------------------------
-- RLS -- team-only access (any authenticated user), matching every other table
-- ---------------------------------------------------------------------------
alter table public.monthly_report_settings enable row level security;
alter table public.baselines enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.monthly_report_metrics enable row level security;
alter table public.monthly_report_tasks enable row level security;

create policy "team_read_monthly_report_settings" on public.monthly_report_settings
  for select to authenticated using (true);
create policy "team_write_monthly_report_settings" on public.monthly_report_settings
  for insert to authenticated with check (true);
create policy "team_update_monthly_report_settings" on public.monthly_report_settings
  for update to authenticated using (true) with check (true);

create policy "team_read_baselines" on public.baselines
  for select to authenticated using (true);
create policy "team_write_baselines" on public.baselines
  for insert to authenticated with check (true);
create policy "team_update_baselines" on public.baselines
  for update to authenticated using (true) with check (true);

create policy "team_read_monthly_reports" on public.monthly_reports
  for select to authenticated using (true);
create policy "team_write_monthly_reports" on public.monthly_reports
  for insert to authenticated with check (true);
create policy "team_update_monthly_reports" on public.monthly_reports
  for update to authenticated using (true) with check (true);

create policy "team_read_monthly_report_metrics" on public.monthly_report_metrics
  for select to authenticated using (true);
create policy "team_write_monthly_report_metrics" on public.monthly_report_metrics
  for insert to authenticated with check (true);
create policy "team_update_monthly_report_metrics" on public.monthly_report_metrics
  for update to authenticated using (true) with check (true);

create policy "team_read_monthly_report_tasks" on public.monthly_report_tasks
  for select to authenticated using (true);
create policy "team_write_monthly_report_tasks" on public.monthly_report_tasks
  for insert to authenticated with check (true);
create policy "team_delete_monthly_report_tasks" on public.monthly_report_tasks
  for delete to authenticated using (true);
