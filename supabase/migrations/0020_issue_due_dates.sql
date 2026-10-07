-- Due dates on individual issues/tasks. Admin-only to set or change --
-- editors can see the date but not edit it, same boundary as severity
-- (enforced here at the DB layer via the existing severity-lock trigger,
-- extended to also cover due_date).

alter table public.issues add column if not exists due_date date;

create or replace function public.enforce_issue_severity_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_team_role() <> 'admin' then
    if new.severity is distinct from old.severity then
      raise exception 'Only an admin can change a task''s priority.';
    end if;
    if new.due_date is distinct from old.due_date then
      raise exception 'Only an admin can change a task''s due date.';
    end if;
  end if;
  return new;
end;
$$;
