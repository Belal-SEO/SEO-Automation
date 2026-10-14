-- Backfill display_name for the two team members whose first name already
-- matches the free-text "assigned_to" value used on issues (set by
-- 0021_default_issue_assignees.sql). The new "work history" view on the
-- Team page matches a member's completed tasks by display_name, so these
-- need to line up with the existing issues.assigned_to values exactly.
update public.team_members set display_name = 'Manny' where email = 'manny@patientclicks.ca' and display_name is null;
update public.team_members set display_name = 'Moin' where email = 'mdmoin.contact@gmail.com' and display_name is null;
