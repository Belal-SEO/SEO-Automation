-- Swap the Screaming Frog CLI crawl source for a self-fetched, Claude-analyzed
-- crawl. The team decided against depending on a licensed CLI/self-hosted
-- runner (see PRD Q3) in favor of run-crawl fetching pages itself and having
-- Claude identify issues directly.

alter table public.audits drop constraint audits_source_check;
alter table public.audits add constraint audits_source_check
  check (source in ('ai_crawl', 'psi', 'manual'));

update public.audits set source = 'ai_crawl' where source = 'screaming_frog';
