-- Records which model analyzed a crawl (now selectable per run, routed
-- through OpenRouter -- see supabase/functions/run-crawl). Nullable since
-- older audits and non-AI-crawl sources (psi, manual, wp_remote) never set it.
alter table public.audits add column if not exists model text;
