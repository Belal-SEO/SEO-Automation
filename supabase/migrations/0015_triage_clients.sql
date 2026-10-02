-- "Triage Clients" column on the Client roster page's Upcoming meetings
-- card -- a manual, free-form watchlist (not tied to the clients table) with
-- a start date and a deadline, added/removed by hand.

create table if not exists public.triage_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  start_date date not null,
  deadline_date date not null,
  created_at timestamptz not null default now()
);

alter table public.triage_clients enable row level security;

create policy "team_read_triage_clients" on public.triage_clients
  for select to authenticated using (true);
create policy "team_write_triage_clients" on public.triage_clients
  for insert to authenticated with check (true);
create policy "team_delete_triage_clients" on public.triage_clients
  for delete to authenticated using (true);
