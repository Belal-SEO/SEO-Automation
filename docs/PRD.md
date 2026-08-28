# PRD — AI Technical SEO Crawler & Audit Agent
**Owner:** Belal / SEO Team · **Sponsor:** Christian Krohn
**Status:** Draft v0.1 (for review) · **Date:** 2026-08-27
**Source:** SEO Automation Call — "AI Automation for Technical Audits"
> This is a working draft generated from the meeting notes. Sections marked **[CONFIRM]** contain assumptions or recommendations that need your sign-off. See Section 14 for the short list of questions to answer before this is final.
---
## 1. Overview
**Feature / Project Name:** AI Technical SEO Crawler & Audit Agent (the "Technical" pillar tool)
**Problem Statement:**
The SEO team performs real technical work — fixing site speed, Cumulative Layout Shift, broken links, and page structure — but the work is manual, slow to run across a growing client base, and largely invisible to clients. Because accomplishments aren't communicated consistently, clients feel "blindsided," question whether any work is happening, and escalate ("a tree falling in the woods"). This threatens retention and caps how many clients each specialist can manage.
**Proposed Solution:**
An AI-assisted tool that automatically crawls each client's site, analyzes technical health from existing data sources (e.g., Screaming Frog), tracks before/after changes over time, and generates client-friendly report drafts on a consistent schedule — so value is proven continuously and the team scales without adding headcount.
**AI Build Summary:**
> Build a Next.js 14 (App Router) web app on Vercel with Supabase (Postgres + Auth + Storage) as the backend. It manages a roster of clinic clients, runs scheduled technical crawls by ingesting Screaming Frog CLI exports and PageSpeed Insights/CrUX Core Web Vitals data, stores issues and metric snapshots per client, and diffs them over time. Use the Anthropic Claude API to turn raw audit deltas into plain-language, before/after client report drafts. Drafts are reviewed by a human, then sent via Gmail / saved to Google Drive. MVP is human-in-the-loop: no automatic CMS writes. Must support scheduled monthly runs, per-client issue tracking, and before/after screenshots.
---
## 2. Goals & Success Metrics
**Primary Goal:** Make completed technical work continuously visible to clients while removing the manual audit-and-report burden, so the team can manage more clients without more people.
**Success Metrics:**
- **Time per client cycle:** reduce the audit → report loop from hours of manual work to <15 min of human review per client per month.
- **Reporting coverage:** ≥95% of active clients receive an automated, consistent monthly technical report.
- **Scale ratio:** measurable increase in clients managed per specialist with no drop in quality.
- **Escalations:** reduction in "no progress / blindsided" client complaints quarter over quarter.
**Anti-goals:**
- Not replacing the strategist's judgment — the tool surfaces and drafts; humans decide and approve.
- Not auto-pushing fixes to a live CMS in MVP (too risky given fragile client backends — see Pure Life).
- Not building the Content or Authority pillars (separate tools).
- Not the GBP poster tool, the sentiment "brain," or content-roadmap automation (all separate initiatives).
---
## 3. Scope & Constraints
**In scope (MVP):**
- Client roster management (clinic name, brand, locations, domain, CMS type).
- Ingest technical crawl data from Screaming Frog (CLI/scheduled export).
- Pull Core Web Vitals (LCP, CLS, INP) via PageSpeed Insights / CrUX.
- Detect and categorize issues: speed/CWV, broken links, page structure/hierarchy, indexability, missing/duplicate meta.
- Store audits per client; compute deltas (before/after) across runs.
- Attach before/after screenshots to fixed issues.
- Generate client-friendly report drafts via Claude (plain language, results-framed).
- Scheduled monthly runs + notifications to the specialist that a draft is ready.
**Out of scope (MVP → later phases):**
- Direct CMS auto-remediation (Phase 2, gated behind heavy safeguards).
- Content pillar and Authority pillar tooling.
- GBP posting automation (separate tool, already in progress).
- Company-wide sentiment "brain" / frustrated-client detection.
- External productization for other clinics (Phase 3 — validate on our own client base first, the "petri dish").
**Technical constraints:**
- **Platform:** Web app (internal team tool). No native mobile in MVP.
- **Must integrate with Screaming Frog** — the team already uses it; don't rebuild crawling from scratch.
- **CMS reality:** clients run varied, fragile stacks (custom themes, multiple page builders, WordPress). Any future write-access must be defensive.
- **Auth:** internal team accounts (email/SSO). Client-facing reports are exported artifacts, not client logins, in MVP.
- **Reporting tone:** framed around "visibility" and outcomes (impressions, clicks, leads) — not raw keyword rankings or jargon.
- **Accessibility:** WCAG 2.1 AA for the internal UI. **[CONFIRM]**
---
## 4. Jobs to Be Done (JTBD)
| Priority | Job Statement |
|----------|---------------|
| 1 | When a client's monthly cycle comes up, I want the site crawled and its technical issues surfaced automatically, so I can act without manually running Screaming Frog and triaging spreadsheets. |
| 2 | When technical work is completed, I want a client-friendly before/after report drafted for me, so the client sees the value and doesn't feel blindsided. |
| 3 | When a site develops a critical or recurring issue, I want to be alerted proactively, so I can fix it before the client complains. |
| 4 | When we take on more clients, I want the audit-and-report loop automated, so we grow without adding headcount. |
> JTBD gives the build (and any AI coding tool) the *why*: this tool exists to make invisible work visible and to break the manual ceiling on client count — not to be a fancier crawler.
---
## 5. User Stories
| ID  | Role | Action | Benefit | JTBD Ref |
|-----|------|--------|---------|----------|
| US1 | SEO Specialist | add/manage a client and their site details | so audits run against correct brand, locations, and domain | J1 |
| US2 | SEO Specialist | schedule or trigger a technical crawl | so I get current site-health data without manual Screaming Frog runs | J1 |
| US3 | SEO Specialist | view a categorized, prioritized issue list per client | so I know what to fix first | J1 |
| US4 | SEO Specialist | see before/after deltas and CWV trends over time | so I can prove improvement | J2 |
| US5 | SEO Specialist | generate a plain-language client report draft | so I communicate value without writing it from scratch | J2 |
| US6 | SEO Specialist | review, edit, and approve a report before it goes out | so nothing inaccurate reaches the client | J2 |
| US7 | SEO Specialist | receive alerts for new critical issues | so I act before the client escalates | J3 |
| US8 | Agency Lead (Christian) | see coverage across all clients (who got reports, who's overdue) | so I can trust the process scales | J4 |
---
## 6. Proposed Experience
**Design Direction:**
A calm, dashboard-first internal tool. Mental model: *"a health tracker for each client's site."* Each client has a vitals page that trends over time; the specialist's job shifts from *doing the audit* to *reviewing and approving* what the agent surfaced and drafted. The interface should make "what changed since last month" the hero — because that delta is the value story sent to clients.
**Key Screens / States:**
- **Client roster** — searchable list of clinics with last-audit date, open-issue count, report status (drafted / sent / overdue).
- **Client detail / vitals** — CWV trend charts, categorized issue table, audit history, before/after gallery.
- **Audit run** — trigger now or manage schedule; shows crawl source and status.
- **Report draft** — AI-generated, editable, with before/after blocks and screenshots; approve & send.
- **Empty state** — no audits yet: prompt to connect a crawl source / run first audit.
- **Error state** — crawl failed / source unreachable: show which source and a retry, never a silent gap.
- **Loading state** — crawls are long-running: show progressive status ("crawling", "analyzing", "drafting"), not a blocking spinner.
**Interaction Model (primary flow):**
1. Specialist opens the roster and sees which clients are due.
2. A scheduled crawl has already run (or they trigger one).
3. The tool shows new/changed issues and CWV deltas.
4. Specialist clicks "Generate report draft."
5. Claude drafts a client-friendly, outcome-framed report with before/after.
6. Specialist edits and approves.
7. Report is sent via Gmail / saved to Drive; status updates to "sent."
**Accessibility Notes:**
- Full keyboard navigation for roster, tables, and the report editor.
- Charts carry text/table equivalents (don't encode meaning in color alone).
- AA contrast minimum. **[CONFIRM level]**
**Figma / Design Link:** _[placeholder — add when available]_
---
## 7. Component Inventory
| Component | Type | Description | Linked Stories |
|-----------|------|-------------|----------------|
| ClientRosterTable | Display | List of clients with status, last audit, open issues | US1, US8 |
| ClientForm | Form | Add/edit client (name, brand, locations, domain, CMS) | US1 |
| AuditTriggerButton | Action | Run crawl now | US2 |
| ScheduleConfig | Form | Set per-client crawl cadence | US2 |
| CrawlStatusBanner | Display | Progressive crawl/analyze/draft status | US2 |
| IssueTable | Display | Filterable, sortable issues by category/severity | US3 |
| SeverityBadge | Display | Visual severity indicator (with text label) | US3 |
| CWVTrendChart | Display | LCP/CLS/INP over time | US4 |
| BeforeAfterGallery | Display | Screenshot pairs for fixed issues | US4, US5 |
| ReportDraftEditor | Form/Display | Editable AI-drafted report preview | US5, US6 |
| ApproveSendBar | Action | Approve, then send/export the report | US6 |
| NotificationSettings | Form | Alert thresholds and channels | US7 |
| AlertToast/Inbox | Display | Critical-issue and draft-ready alerts | US7 |
| CoverageOverview | Display | Agency-wide report status | US8 |
| EmptyState / ErrorState | Display | No-data and failure views | all |
---
## 8. Data Models
```typescript
interface Client {
  id: string;                 // UUID
  name: string;               // clinic name
  brand: string;               // corrected brand (must match source-of-truth DB)
  locations: string[];        // one or more physical locations
  domain: string;              // primary site URL
  cmsType: string | null;      // e.g. "wordpress" | "custom" | null (fragile-backend flag)
  createdAt: string;           // ISO8601
  updatedAt: string;
}
interface Audit {
  id: string;
  clientId: string;            // FK -> Client
  runAt: string;                // ISO8601
  source: 'screaming_frog' | 'psi' | 'manual';
  status: 'queued' | 'crawling' | 'analyzing' | 'complete' | 'failed';
  error: string | null;
}
interface Issue {
  id: string;
  auditId: string;              // FK -> Audit
  clientId: string;             // denormalized for fast per-client queries
  category: 'cwv' | 'broken_link' | 'page_structure' | 'indexability' | 'meta';
  severity: 'critical' | 'high' | 'medium' | 'low';
  url: string;                  // affected page
  description: string;
  status: 'open' | 'in_progress' | 'fixed';
  detectedAt: string;
  fixedAt: string | null;
  beforeScreenshotUrl: string | null;  // Supabase Storage
  afterScreenshotUrl: string | null;
}
interface MetricSnapshot {
  id: string;
  clientId: string;             // FK -> Client
  auditId: string;              // FK -> Audit
  metric: 'lcp' | 'cls' | 'inp' | 'broken_link_count';
  value: number;                // enables before/after deltas & trend charts
  capturedAt: string;
}
interface Report {
  id: string;
  clientId: string;             // FK -> Client
  periodStart: string;          // reporting window
  periodEnd: string;
  auditIds: string[];           // audits this report summarizes
  status: 'draft' | 'approved' | 'sent';
  content: string;              // Claude-generated markdown/html, human-editable
  sentVia: 'gmail' | 'drive' | null;
  sentAt: string | null;
}
```
---
## 9. API / Integration Surface
Backend is Supabase (Postgres + Auth + Storage). CRUD is table operations via the Supabase client; long-running and AI work runs in Edge Functions / a worker.
**Table operations (RLS-protected, team-only):**
| Operation | Table | Description |
|-----------|-------|-------------|
| select/insert/update | `clients` | Manage client roster |
| select/insert | `audits` | Create and read audit runs |
| select | `issues` | Read categorized issues (filter by client/category/status) |
| update | `issues` | Mark fixed, attach screenshots |
| select/insert | `metric_snapshots` | Trend + before/after data |
| select/insert/update | `reports` | Draft, approve, mark sent |
**Functions / workers:**
| Name | Trigger | Description |
|------|---------|-------------|
| `run-crawl` | manual / scheduled (cron) | Kicks off Screaming Frog CLI export + PSI pull, writes Audit + Issues + MetricSnapshots |
| `generate-report` | on demand | Sends audit deltas to Claude API, stores draft in `reports` |
| `send-report` | on approve | Sends via Gmail API or writes Google Doc to Drive |
| `alert-check` | post-crawl | Flags new critical issues, emits notification |
**External integrations:**
- **Screaming Frog SEO Spider CLI** — headless crawl + CSV/export ingestion (the team's existing tool).
- **PageSpeed Insights / CrUX API** — Core Web Vitals (LCP, CLS, INP).
- **Anthropic Claude API** — report drafting from structured audit deltas.
- **Gmail API + Google Drive API** — deliver/store report drafts (team already uses Google Workspace).
- **[Phase 2] CMS API** (e.g., WordPress REST) — guarded auto-fixes.
---
## 10. State Management Map
| State | Location | Persistence | Notes |
|-------|----------|-------------|-------|
| Client roster | Server (Supabase) | Persistent | Source of truth; brand/location must reconcile with the master DB (Amir's corrections) |
| Audit results & issues | Server (Supabase) | Persistent | Historical — needed for before/after |
| Metric snapshots | Server (Supabase) | Persistent | Powers trend charts |
| Report drafts | Server (Supabase) | Persistent | Editable until sent |
| Crawl-in-progress status | Server + client subscription | Session | Realtime status via Supabase channels |
| Table filters / sort | URL params | Session | Shareable, back-button friendly |
| Auth/session | Supabase Auth context | Persistent | Team-only access |
---
## 11. Tech Stack Recommendation **[CONFIRM]**
> No stack was specified in the meeting. This recommendation is grounded in tools you already have connected (Supabase, Vercel, Gmail/Drive) and in Christian's existing use of Claude. Confirm or override.
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript | Fast to build, great AI-tool support (v0/Cursor), pairs with Vercel |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent internal-tool UI |
| Backend / BaaS | Supabase (Postgres, Auth, Storage, Edge Functions) | Already connected; auth + DB + file storage in one; RLS for team-only access |
| Crawl engine | Screaming Frog SEO Spider CLI | Existing team tool; don't rebuild crawling |
| Vitals data | PageSpeed Insights / CrUX API | Authoritative Core Web Vitals |
| AI | Anthropic Claude API | Report drafting; consistent with current workflow |
| Delivery | Gmail API + Google Drive API | Team already sends client emails; drafts land where they work |
| Hosting | Vercel | Already connected; native Next.js deploys + cron |
| Scheduling | Vercel Cron / Supabase scheduled functions | Monthly automated runs |
---
## 12. Suggested File Structure
```
seo-crawler/
├── app/
│   ├── (dashboard)/
│   │   ├── clients/
│   │   │   ├── page.tsx                 # roster
│   │   │   └── [clientId]/
│   │   │       ├── page.tsx             # client vitals/detail
│   │   │       └── reports/[reportId]/page.tsx
│   │   └── layout.tsx
│   └── api/
│       ├── crawl/route.ts               # trigger run-crawl
│       └── reports/route.ts             # generate/send
├── components/
│   └── crawler/
│       ├── ClientRosterTable.tsx
│       ├── IssueTable.tsx
│       ├── CWVTrendChart.tsx
│       ├── BeforeAfterGallery.tsx
│       └── ReportDraftEditor.tsx
├── lib/
│   ├── supabase.ts
│   ├── screamingfrog.ts                 # CLI invoke + parse export
│   ├── psi.ts                           # Core Web Vitals fetch
│   ├── claude.ts                        # report drafting
│   ├── google.ts                        # Gmail/Drive delivery
│   └── types.ts
├── supabase/
│   ├── migrations/                      # tables + RLS
│   └── functions/                       # run-crawl, generate-report, send-report, alert-check
└── ...
```
---
## 13. Acceptance Criteria
**US1 — Manage a client**
- [ ] Creating a client persists name, brand, locations[], domain, cmsType.
- [ ] Domain is validated as a URL; invalid input shows an inline error.
- [ ] Edge case: duplicate domain warns before saving.
**US2 — Run/schedule a crawl**
- [ ] "Run now" creates an Audit with status `queued` and begins processing.
- [ ] A monthly schedule triggers a crawl automatically for each active client.
- [ ] Error state: a failed crawl sets status `failed` with a readable `error` and a retry action.
**US3 — View issues**
- [ ] Issues list returns items grouped by category with severity badges.
- [ ] Filtering by category and status returns only matching rows.
- [ ] Empty state shown when an audit found zero issues.
**US4 — Before/after & trends**
- [ ] CWV chart plots LCP/CLS/INP across at least two audits.
- [ ] A fixed issue displays before and after screenshots side by side.
- [ ] Delta (improvement/regression) is computed and labeled correctly.
**US5 — Generate report draft**
- [ ] "Generate report" returns a plain-language draft framed around outcomes (impressions/clicks/leads context), not raw keyword rankings.
- [ ] Draft includes the period, fixed items, and before/after evidence.
- [ ] If the Claude call fails, the user sees an error and the draft is not marked ready.
**US6 — Review & approve**
- [ ] Draft is editable before sending.
- [ ] Report can be marked `approved`, then `sent`; status is visible in the roster.
- [ ] A report cannot be sent while status is `draft`.
**US7 — Alerts**
- [ ] A newly detected `critical` issue emits a notification to the specialist.
- [ ] Alert thresholds are configurable per client.
**US8 — Coverage overview**
- [ ] Overview lists every active client with report status (drafted/sent/overdue).
- [ ] Clients past their monthly window without a sent report are flagged `overdue`.
---
## 14. Open Questions & Risks
**Questions to answer to finalize this PRD:**
- **Q1 — Tech stack:** Confirm Next.js + Supabase + Vercel + Claude, or state your preferred stack. — *Owner: Belal / Christian*
- **Q2 — Report destination:** Should approved reports send as **Gmail emails**, **Google Docs in Drive**, a **PDF**, or a client-facing dashboard? (Meeting mentioned emails with before/after screenshots.) — *Owner: SEO Team*
- **Q3 — Screaming Frog access:** Is there a licensed CLI seat available to run headless/scheduled crawls, or do we ingest manual exports in MVP? — *Owner: Hashim K / Belal*
- **Q4 — CMS auto-fix appetite:** Confirm auto-remediation is Phase 2 only. Which CMS do most clinics run (WordPress?) so we can scope the later integration? — *Owner: SEO Team*
- **Q5 — Source-of-truth DB:** How does this tool read correct brand/location data — does it reconcile with the master database Amir maintains? — *Owner: Christian / Amir*
- **Q6 — Cadence:** Monthly reports were discussed alongside "weekly client notification systems." Which is the MVP cadence? — *Owner: Christian*
**Risks & tradeoffs:**
- **Risk — Fragile client backends** (custom themes, multiple page builders, sections disappearing on edit, per Pure Life). *Mitigation:* MVP is read-only; no CMS writes until Phase 2 with backups/guardrails.
- **Risk — AI report accuracy.** A wrong claim in a client report erodes trust further. *Mitigation:* mandatory human approval before send; ground drafts strictly in stored audit data.
- **Risk — Data integrity at the source.** Reports inherit any bad brand/location data. *Mitigation:* reconcile against the corrected master DB (Q5).
- **Tradeoff — Screaming Frog dependency.** Faster to build on the existing tool, but couples us to its CLI/licensing rather than a fully native crawler.
---
## 15. Rollout & Next Steps
**MVP scope:** The smallest version that proves the core job — *make completed technical work visible, automatically.*
- **Includes:** client roster, scheduled crawl ingest (Screaming Frog + CWV), issue tracking with before/after, Claude-drafted reports, human review + send, coverage overview.
- **Excludes:** CMS auto-fixes, content/authority pillars, GBP posting, sentiment brain, external productization.
**Phase 2+ ideas:**
- Guarded CMS auto-remediation (WordPress REST first, with backups/rollback).
- Client-facing dashboard login.
- Roll technical/content/authority into one unified "Visibility" report.
- Productize for external clinics once validated on our own base.
**Sign-off needed from:**
- [ ] Christian (sponsor / strategy)
- [ ] Belal / SEO Team (build owner)
- [ ] Hashim K (Screaming Frog / testing)
- [ ] Amir (source-of-truth data)
**Next steps:**
1. Answer Q1–Q6 above — *Owner: Belal, this week.*
2. Confirm stack and Screaming Frog access — *Owner: Belal / Hashim K.*
3. Feed this PRD into the build tool (Cursor/v0) and scaffold the roster + audit ingest — *Owner: SEO Team.*
4. Report progress at the weekly SEO Automation Call.
---
*Draft generated from the SEO Automation Call notes. Ground every decision in the core job: prove value continuously so clients never feel blindsided, and scale client count without scaling headcount.*
