# CrawlR

AI Technical SEO Crawler & Audit Agent — an internal tool that crawls each
clinic client's site, tracks technical health over time, and drafts
client-friendly before/after reports so completed work stays visible.

Built per the [AI Technical SEO Crawler & Audit Agent PRD](./docs) (Next.js
14 App Router, Supabase, Anthropic Claude, Google Workspace delivery).

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Crawl engine:** self-fetched (plain HTTP, same-domain BFS) — no external crawl service or licensed CLI
- **Issue detection:** Anthropic Claude API, given the crawled page data
- **Core Web Vitals:** PageSpeed Insights / CrUX API
- **Report drafting:** Anthropic Claude API
- **Delivery:** Gmail API + Google Drive API
- **Hosting:** Vercel (Cron for the monthly audit cycle)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase / API credentials
npm run dev
```

### Supabase setup

1. Link this repo to a Supabase project: `supabase link --project-ref <ref>`
2. Apply the schema: `supabase db push` (or `supabase migration up` locally)
3. Deploy the Edge Functions: `supabase functions deploy run-crawl generate-report send-report alert-check`
4. Set Edge Function secrets (`supabase secrets set`) — **these are separate
   from Vercel's env vars and must be set on the Supabase side too**:
   `ANTHROPIC_API_KEY` (required — `run-crawl` uses it to analyze crawled
   pages, `generate-report` to draft reports), `PAGESPEED_API_KEY` (optional),
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
   `GOOGLE_DRIVE_REPORTS_FOLDER_ID`, `ALERT_WEBHOOK_URL`.
5. Regenerate `lib/supabase/database.types.ts` from the linked project:
   `supabase gen types typescript --linked > lib/supabase/database.types.ts`

### Crawling

`run-crawl` fetches up to 15 same-domain pages itself (plain `fetch`, BFS
from the homepage — see `supabase/functions/run-crawl/index.ts`), extracts
title/meta/H1/word count/status per page, and sends that to Claude to
identify issues. No external crawl API, license, or self-hosted runner
needed. Core Web Vitals still come from PageSpeed Insights, since that
needs real-user/Lighthouse data no page fetch can produce.

## Project structure

See `supabase/migrations/` for the schema (`clients`, `audits`,
`issues`, `metric_snapshots`, `reports`) and `supabase/functions/` for the
crawl/report/delivery/alert Edge Functions. App routes live under
`app/(dashboard)/`; shared UI is in `components/crawler/` and `components/ui/`.

## MVP status

Implements the roster, audit ingest, issue tracking with before/after
screenshots, Claude-drafted reports with human approve/send, and the
agency-wide coverage overview described in the PRD. CMS auto-remediation,
the Content/Authority pillars, and GBP posting are explicitly out of scope
for this phase.
