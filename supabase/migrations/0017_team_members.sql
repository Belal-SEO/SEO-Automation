-- Team roles: Admin (full access) and Editor (task-manager only -- scoped
-- down in the UI to the client roster + per-client task boards; severity
-- edits and deletes are blocked at the DB layer too, not just hidden in the
-- UI). Membership is keyed by email, checked against the signed-in user's
-- JWT email claim -- anyone who signs in but isn't listed here gets no
-- dashboard access at all (see app/(dashboard)/layout.tsx).

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null check (role in ('admin', 'editor')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

-- Security-definer so RLS policies on every other table can call this
-- without recursing into team_members' own RLS.
create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.team_members
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create policy "team_read_team_members" on public.team_members
  for select to authenticated using (true);
create policy "admin_write_team_members" on public.team_members
  for insert to authenticated with check (public.current_team_role() = 'admin');
create policy "admin_update_team_members" on public.team_members
  for update to authenticated using (public.current_team_role() = 'admin') with check (public.current_team_role() = 'admin');
create policy "admin_delete_team_members" on public.team_members
  for delete to authenticated using (public.current_team_role() = 'admin');

-- Seed the account owner as the first admin so nobody gets locked out once
-- this migration lands. Safe to re-run.
insert into public.team_members (email, role, display_name)
values ('belalhosen02@gmail.com', 'admin', 'Belal')
on conflict (email) do nothing;
