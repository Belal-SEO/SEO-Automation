-- NAP consistency, structured data, and location/service page quality don't
-- fit the existing five issue categories -- give local SEO its own bucket
-- so it's filterable in the issue table rather than getting crammed into
-- page_structure or meta.
alter table public.issues drop constraint issues_category_check;
alter table public.issues add constraint issues_category_check
  check (category in ('cwv', 'broken_link', 'page_structure', 'indexability', 'meta', 'local_seo'));
