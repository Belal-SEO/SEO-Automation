-- AI Technical SEO Crawler & Audit Agent — initial schema
-- Tables: clients, audits, issues, metric_snapshots, reports
-- Access model: internal team only. Every table is readable/writable by any
-- authenticated user (the whole team shares one client roster); anonymous
-- access is denied. Tighten to per-user ownership later if the team wants
-- individual client assignment.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  locations text[] not null default '{}',
  domain text not null,
  cms_type text,
  report_cadence_days integer not null default 30,
  critical_alert_threshold integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_domain_format check (domain ~* '^https?://')
);

create unique index if not exists clients_domain_key on public.clients (lower(domain));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audits
-- ---------------------------------------------------------------------------
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  run_at timestamptz not null default now(),
  source text not null check (source in ('screaming_frog', 'psi', 'manual')),
  status text not null default 'queued'
    check (status in ('queued', 'crawling', 'analyzing', 'complete', 'failed')),
  error text
);

create index if not exists audits_client_id_run_at_idx
  on public.audits (client_id, run_at desc);

-- ---------------------------------------------------------------------------
-- issues
-- ---------------------------------------------------------------------------
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  category text not null
    check (category in ('cwv', 'broken_link', 'page_structure', 'indexability', 'meta')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  url text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'fixed')),
  detected_at timestamptz not null default now(),
  fixed_at timestamptz,
  before_screenshot_url text,
  after_screenshot_url text
);

create index if not exists issues_client_id_status_idx on public.issues (client_id, status);
create index if not exists issues_client_id_category_idx on public.issues (client_id, category);
create index if not exists issues_audit_id_idx on public.issues (audit_id);

-- ---------------------------------------------------------------------------
-- metric_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  audit_id uuid not null references public.audits (id) on delete cascade,
  metric text not null check (metric in ('lcp', 'cls', 'inp', 'broken_link_count')),
  value double precision not null,
  captured_at timestamptz not null default now()
);

create index if not exists metric_snapshots_client_metric_idx
  on public.metric_snapshots (client_id, metric, captured_at desc);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  audit_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  content text not null default '',
  sent_via text check (sent_via in ('gmail', 'drive')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_period_valid check (period_end >= period_start),
  constraint reports_sent_requires_approval
    check (status <> 'sent' or sent_at is not null)
);

create index if not exists reports_client_id_created_at_idx
  on public.reports (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — team-only access (any authenticated user)
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.audits enable row level security;
alter table public.issues enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.reports enable row level security;

create policy "team_read_clients" on public.clients
  for select to authenticated using (true);
create policy "team_write_clients" on public.clients
  for insert to authenticated with check (true);
create policy "team_update_clients" on public.clients
  for update to authenticated using (true) with check (true);

create policy "team_read_audits" on public.audits
  for select to authenticated using (true);
create policy "team_write_audits" on public.audits
  for insert to authenticated with check (true);
create policy "team_update_audits" on public.audits
  for update to authenticated using (true) with check (true);

create policy "team_read_issues" on public.issues
  for select to authenticated using (true);
create policy "team_write_issues" on public.issues
  for insert to authenticated with check (true);
create policy "team_update_issues" on public.issues
  for update to authenticated using (true) with check (true);

create policy "team_read_metric_snapshots" on public.metric_snapshots
  for select to authenticated using (true);
create policy "team_write_metric_snapshots" on public.metric_snapshots
  for insert to authenticated with check (true);

create policy "team_read_reports" on public.reports
  for select to authenticated using (true);
create policy "team_write_reports" on public.reports
  for insert to authenticated with check (true);
create policy "team_update_reports" on public.reports
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for before/after screenshots
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audit-screenshots', 'audit-screenshots', false)
on conflict (id) do nothing;

create policy "team_read_audit_screenshots" on storage.objects
  for select to authenticated using (bucket_id = 'audit-screenshots');
create policy "team_write_audit_screenshots" on storage.objects
  for insert to authenticated with check (bucket_id = 'audit-screenshots');
