-- Two client lifecycles: "new" clients run a 90-day onboarding sprint of
-- manually-tracked tasks plus Monthly Reporting (GSC, baseline); "legacy"
-- clients use the crawl-audit pillar. New clients auto-graduate to legacy
-- once their sprint deadline passes with every assigned task completed --
-- see lib/clientStage.ts and the client-stage-check cron.

alter table public.clients add column if not exists stage text
  check (stage in ('new', 'legacy'));

-- Every client that already exists predates this feature and has been
-- running the crawl-audit pillar all along -- backfill as legacy, not new.
update public.clients set stage = 'legacy' where stage is null;

alter table public.clients alter column stage set not null;
alter table public.clients alter column stage set default 'new';

alter table public.clients add column if not exists sprint_started_at timestamptz;
alter table public.clients add column if not exists sprint_deadline date;
alter table public.clients add column if not exists stage_changed_at timestamptz;

-- Manually-added onboarding/sprint tasks for "new" clients, tracked through
-- the same issues table (status, assigned_to, Overview, Executables) as
-- every other issue category.
alter table public.issues drop constraint issues_category_check;
alter table public.issues add constraint issues_category_check
  check (category in (
    'cwv', 'broken_link', 'page_structure', 'indexability', 'meta', 'local_seo',
    'malware', 'vulnerability', 'outdated_software', 'sprint_task'
  ));
