-- Extends the baseline snapshot with fields the "Import from Search Console"
-- flow can auto-fill (sitemap status/page count, top 3 pages) alongside the
-- existing manual-entry fields. Note: total indexed pages and "generative
-- engine" (AI Overviews) appearance counts have NO Search Console API --
-- Google only exposes them in the Console UI -- so indexed_pages stays
-- manual (as it already was) and generative_engine_appearances is manual too.

alter table public.baselines add column if not exists sitemap_submitted boolean;
alter table public.baselines add column if not exists sitemap_page_count numeric;
alter table public.baselines add column if not exists top_pages jsonb not null default '[]'::jsonb;
alter table public.baselines add column if not exists generative_engine_appearances numeric not null default 0;
