// Types for the Monthly Reporting tool -- kept separate from lib/types.ts
// (the Technical Audit tool's domain) since this is its own pillar sharing
// only the client roster.

export interface MonthlyReportSettings {
  clientId: string;
  agencyLabel: string | null;
  websiteUrl: string | null;
  clientEmail: string | null;
  gscSiteUrl: string | null;
  sendDayOfMonth: number;
  reviewLeadDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface Baseline {
  id: string;
  clientId: string;
  organicImpressions: number;
  organicClicks: number;
  indexedPages: number;
  totalBacklinks: number;
  capturedRangeStart: string | null;
  capturedRangeEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MonthlyReportStatus = "draft" | "in_review" | "approved" | "sent";

export interface MonthlyReport {
  id: string;
  clientId: string;
  periodLabel: string;
  title: string;
  subtitle: string | null;
  accentColor: string;
  periodStart: string;
  periodEnd: string;
  scheduledSendDate: string;
  status: MonthlyReportStatus;
  sortIndex: number;
  generatedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MonthlyMetricKey =
  | "issues_fixed"
  | "pages_optimised"
  | "new_pages"
  | "backlinks_built"
  | "blog_posts"
  | "impressions"
  | "clicks"
  | "pages_indexed"
  | "gbp_optimised"
  | "gbp_posts"
  | "good_leads";

export type MetricSource = "gsc" | "sheet" | "gbp" | "manual";

export interface MonthlyReportMetric {
  id: string;
  monthlyReportId: string;
  key: MonthlyMetricKey;
  label: string;
  sublabel: string | null;
  valueNumber: number | null;
  valueText: string | null;
  source: MetricSource;
  autoValue: number | null;
  isOverridden: boolean;
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MonthlyTaskListKey =
  | "issues"
  | "pages_optimised"
  | "new_pages"
  | "backlinks"
  | "blog_posts"
  | "cro"
  | "notes";

export interface MonthlyReportTask {
  id: string;
  monthlyReportId: string;
  listKey: MonthlyTaskListKey;
  text: string;
  url: string | null;
  sortIndex: number;
  createdAt: string;
}

export const METRIC_LABELS: Record<MonthlyMetricKey, { label: string; sublabel: string }> = {
  issues_fixed: { label: "Issues Fixed", sublabel: "Technical/onsite" },
  pages_optimised: { label: "Pages Optimised", sublabel: "On-page work" },
  new_pages: { label: "New Pages", sublabel: "Published this period" },
  backlinks_built: { label: "Backlinks Built", sublabel: "Authority building" },
  blog_posts: { label: "Blog Posts", sublabel: "Published this period" },
  impressions: { label: "Impressions", sublabel: "GSC — selected range" },
  clicks: { label: "Clicks", sublabel: "GSC — selected range" },
  pages_indexed: { label: "Indexed Pages", sublabel: "Total indexed" },
  gbp_optimised: { label: "GBP Optimised", sublabel: "Yes / No" },
  gbp_posts: { label: "GBP Posts", sublabel: "Published this period" },
  good_leads: { label: "Good Leads", sublabel: "Qualified this period" },
};

// Metrics we can live-pull in this MVP; everything else is manual until
// Phase 2 (Sheets for backlinks, GBP API for posts).
export const AUTO_CAPABLE_METRICS: Partial<Record<MonthlyMetricKey, MetricSource>> = {
  impressions: "gsc",
  clicks: "gsc",
};

export const TASK_LIST_LABELS: Record<MonthlyTaskListKey, string> = {
  issues: "Issues Fixed",
  pages_optimised: "Pages Optimised",
  new_pages: "New Pages",
  backlinks: "Backlinks Built",
  blog_posts: "Blog Posts",
  cro: "CRO Improvements",
  notes: "Notes",
};

export interface MonthlyReportRosterRow {
  clientId: string;
  brand: string;
  hasSettings: boolean;
  hasBaseline: boolean;
  lastReportPeriodLabel: string | null;
  lastReportStatus: MonthlyReportStatus | null;
  nextScheduledSendDate: string | null;
}
