-- Removes the Executables feature: a curated "this cycle's work queue"
-- subset of issues, now redundant since completed tasks already sync into
-- the monthly report and get a month-over-month history directly from the
-- Issues/Sprint Tasks lists (see CompletedTasksHistory), with no detour
-- through a separate curated board required.

drop index if exists public.issues_client_id_is_executable_idx;
alter table public.issues drop column if exists is_executable;
alter table public.issues drop column if exists executable_added_at;

-- Historical rows keep whatever activity_type they already have (some carry
-- the now-retired added_to_executables/removed_from_executables values) --
-- NOT VALID skips validating those, only new inserts are restricted.
alter table public.issue_activity drop constraint if exists issue_activity_activity_type_check;
alter table public.issue_activity add constraint issue_activity_activity_type_check
  check (activity_type in ('note', 'status_change')) not valid;
