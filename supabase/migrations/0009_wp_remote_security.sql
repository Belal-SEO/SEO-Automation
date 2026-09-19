-- WP Remote (BlogVault API) security sync: malware detections, known
-- vulnerabilities, and outdated software land in the same `issues` table as
-- SEO audit issues, so they show up in the same Overview/Executables basket.

-- Manual override for matching a client to its WP Remote site when the
-- domain doesn't match exactly (www/protocol variants, multiple sites, etc).
-- Auto-filled on first successful sync when a domain match is found.
alter table public.clients add column if not exists wp_remote_site_id text;

-- Stable external identifier for a finding (a specific malware detection,
-- vulnerability, or outdated component), so repeated syncs update the same
-- row instead of inserting duplicates every run.
alter table public.issues add column if not exists external_id text;

create unique index if not exists issues_client_id_external_id_key
  on public.issues (client_id, external_id) where external_id is not null;

alter table public.issues drop constraint issues_category_check;
alter table public.issues add constraint issues_category_check
  check (category in (
    'cwv', 'broken_link', 'page_structure', 'indexability', 'meta', 'local_seo',
    'malware', 'vulnerability', 'outdated_software'
  ));

alter table public.audits drop constraint audits_source_check;
alter table public.audits add constraint audits_source_check
  check (source in ('ai_crawl', 'psi', 'manual', 'wp_remote'));
