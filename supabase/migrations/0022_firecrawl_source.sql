-- Allow "firecrawl" as an audit source, for the new Firecrawl-powered crawl
-- option on "Run crawl now" (alongside the existing self-fetched crawler).
alter table public.audits drop constraint if exists audits_source_check;
alter table public.audits add constraint audits_source_check
  check (source in ('ai_crawl', 'firecrawl', 'psi', 'manual', 'wp_remote'));
