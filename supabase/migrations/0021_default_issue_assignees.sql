-- Permanent default assignees by issue source, across every client:
-- WP Remote security findings (malware/vulnerability/outdated_software) ->
-- Manny. Crawl-detected SEO/technical issues (cwv/broken_link/
-- page_structure/indexability/meta/local_seo) -> Moin. Manual tasks
-- (sprint_task) are untouched -- those are assigned by whoever creates them.
--
-- Backfill first (unconditional -- this is a global correction, not just
-- filling gaps), then a trigger so every future issue gets the right
-- assignee automatically regardless of which path inserts it (AI crawl
-- Edge Function or WP Remote sync). A manually-set assignee on insert is
-- still respected; the trigger only fills in when assigned_to is null, and
-- existing per-issue reassignment via the UI still works afterward.

update public.issues
set assigned_to = 'Manny'
where category in ('malware', 'vulnerability', 'outdated_software');

update public.issues
set assigned_to = 'Moin'
where category in ('cwv', 'broken_link', 'page_structure', 'indexability', 'meta', 'local_seo');

create or replace function public.default_issue_assignee()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_to is null then
    if new.category in ('malware', 'vulnerability', 'outdated_software') then
      new.assigned_to := 'Manny';
    elsif new.category in ('cwv', 'broken_link', 'page_structure', 'indexability', 'meta', 'local_seo') then
      new.assigned_to := 'Moin';
    end if;
  end if;
  return new;
end;
$$;

create trigger issues_default_assignee
  before insert on public.issues
  for each row execute function public.default_issue_assignee();
