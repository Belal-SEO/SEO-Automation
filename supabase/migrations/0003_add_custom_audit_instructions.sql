-- Lets a specialist tune what the crawl audit looks for per client (e.g.
-- specific service/location pages, competitor NAP details, brand voice
-- notes) without needing a code change or redeploy. NULL/empty means "just
-- use the default local SEO audit framework."
alter table public.clients add column if not exists custom_audit_instructions text;
