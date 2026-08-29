-- "Executables": a curated subset of issues a specialist picks each cycle to
-- actively work on, with status tracking and a dated activity history (notes
-- + status changes) per client -- separate from the full audit issue list.

alter table public.issues add column if not exists is_executable boolean not null default false;
alter table public.issues add column if not exists executable_added_at timestamptz;

create index if not exists issues_client_id_is_executable_idx
  on public.issues (client_id, is_executable) where is_executable;

create table if not exists public.issue_activity (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  activity_type text not null check (activity_type in ('note', 'status_change', 'added_to_executables', 'removed_from_executables')),
  note text,
  new_status text check (new_status in ('open', 'in_progress', 'fixed')),
  created_at timestamptz not null default now()
);

create index if not exists issue_activity_client_id_created_at_idx
  on public.issue_activity (client_id, created_at desc);
create index if not exists issue_activity_issue_id_idx on public.issue_activity (issue_id);

alter table public.issue_activity enable row level security;

create policy "team_read_issue_activity" on public.issue_activity
  for select to authenticated using (true);
create policy "team_write_issue_activity" on public.issue_activity
  for insert to authenticated with check (true);
