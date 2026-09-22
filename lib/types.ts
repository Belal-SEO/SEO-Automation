export type CmsType = "wordpress" | "custom" | "shopify" | "wix" | "squarespace" | null;

export type ClientStage = "new" | "legacy";

export interface Client {
  id: string;
  name: string;
  brand: string;
  locations: string[];
  domain: string;
  cmsType: CmsType;
  reportCadenceDays: number;
  criticalAlertThreshold: number;
  customAuditInstructions: string | null;
  wpRemoteSiteId: string | null;
  stage: ClientStage;
  sprintStartedAt: string | null;
  sprintDeadline: string | null;
  stageChangedAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AuditSource = "ai_crawl" | "psi" | "manual" | "wp_remote";
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
  | "meta"
  | "local_seo"
  | "malware"
  | "vulnerability"
  | "outdated_software"
  | "sprint_task";

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
  isExecutable: boolean;
  executableAddedAt: string | null;
  assignedTo: string | null;
  externalId: string | null;
}

export type IssueActivityType = "note" | "status_change" | "added_to_executables" | "removed_from_executables";

export interface IssueActivity {
  id: string;
  issueId: string;
  clientId: string;
  activityType: IssueActivityType;
  note: string | null;
  newStatus: IssueStatus | null;
  createdAt: string;
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
  local_seo: "Local SEO",
  malware: "Malware / Malicious Code",
  vulnerability: "Known Vulnerability",
  outdated_software: "Outdated Software",
  sprint_task: "Sprint Task",
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

export interface IssueSeveritySummary {
  total: number;
  bySeverity: Record<IssueSeverity, number>;
}
