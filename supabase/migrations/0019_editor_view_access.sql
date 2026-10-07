-- Editors now get read access to the agency-wide scheduling cards (Triage
-- clients / Quarterly meetings) -- they still can't add or remove entries,
-- which stays admin-only via the existing insert/delete policies on these
-- two tables.
alter policy "team_read_triage_clients" on public.triage_clients
  using (true);
alter policy "team_read_manual_quarterly_meetings" on public.manual_quarterly_meetings
  using (true);
