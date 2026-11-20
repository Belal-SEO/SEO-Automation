-- Allow "ahrefs" as an audit source, for the new Ahrefs Site Audit crawl
-- source option on "Run crawl now" (alongside self-crawl and Firecrawl).
alter table public.audits drop constraint if exists audits_source_check;
alter table public.audits add constraint audits_source_check
  check (source in ('ai_crawl', 'firecrawl', 'ahrefs', 'psi', 'manual', 'wp_remote'));
