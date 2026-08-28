export type CmsType = "wordpress" | "custom" | "shopify" | "wix" | "squarespace" | null;

export interface Client {
  id: string;
  name: string;
  brand: string;
  locations: string[];
  domain: string;
  cmsType: CmsType;
  reportCadenceDays: number;
  criticalAlertThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AuditSource = "screaming_frog" | "psi" | "manual";
export type AuditStatus = "queued" | "crawling" | "analyzing" | "complete" | "failed";

export interface Audit {
  id: string;
  clientId: string;
  runAt: string;
  source: AuditSource;
  status: AuditStatus;
  error: string | null;
}

export type IssueCategory =
  | "cwv"
  | "broken_link"
  | "page_structure"
  | "indexability"
  | "meta";

export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "in_progress" | "fixed";

export interface Issue {
  id: string;
  auditId: string;
  clientId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  url: string;
  description: string;
  status: IssueStatus;
  detectedAt: string;
  fixedAt: string | null;
  beforeScreenshotUrl: string | null;
  afterScreenshotUrl: string | null;
}

export type MetricName = "lcp" | "cls" | "inp" | "broken_link_count";

export interface MetricSnapshot {
  id: string;
  clientId: string;
  auditId: string;
  metric: MetricName;
  value: number;
  capturedAt: string;
}

export type ReportStatus = "draft" | "approved" | "sent";
export type ReportDelivery = "gmail" | "drive" | null;

export interface Report {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  auditIds: string[];
  status: ReportStatus;
  content: string;
  sentVia: ReportDelivery;
  sentAt: string | null;
  createdAt: string;
}

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  cwv: "Core Web Vitals",
  broken_link: "Broken Links",
  page_structure: "Page Structure",
  indexability: "Indexability",
  meta: "Meta Tags",
};

export const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface ClientRosterRow extends Client {
  lastAuditAt: string | null;
  openIssueCount: number;
  latestReportStatus: ReportStatus | "overdue" | "none";
}
