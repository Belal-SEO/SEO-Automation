-- Clients manually added to the "Quarterly client meetings" section (This
-- week / Next week) on the Client roster page, alongside calendar events
-- whose title mentions "Quarterly". Free-form, not tied to the clients table
-- -- same shape as triage_clients, but with a single meeting date.

create table if not exists public.manual_quarterly_meetings (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  meeting_date date not null,
  created_at timestamptz not null default now()
);

alter table public.manual_quarterly_meetings enable row level security;

create policy "team_read_manual_quarterly_meetings" on public.manual_quarterly_meetings
  for select to authenticated using (true);
create policy "team_write_manual_quarterly_meetings" on public.manual_quarterly_meetings
  for insert to authenticated with check (true);
create policy "team_delete_manual_quarterly_meetings" on public.manual_quarterly_meetings
  for delete to authenticated using (true);
