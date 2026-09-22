"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { syncFixedIssueToReport } from "@/lib/issueReportSync";
import {
  ISSUE_CATEGORY_LABELS,
  SEVERITY_ORDER,
  type Client,
  type Issue,
  type IssueCategory,
  type IssueSeverity,
  type IssueStatus,
} from "@/lib/types";

const SECURITY_CATEGORIES = new Set<IssueCategory>(["malware", "vulnerability", "outdated_software"]);
const SPRINT_CATEGORIES = new Set<IssueCategory>(["sprint_task"]);
type IssueType = "all" | "seo" | "security" | "sprint";

function categoryType(category: IssueCategory): IssueType {
  if (SECURITY_CATEGORIES.has(category)) return "security";
  if (SPRINT_CATEGORIES.has(category)) return "sprint";
  return "seo";
}

const UNASSIGNED = "__unassigned__";

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "fixed", label: "Completed" },
];

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function OverviewRow({ issue, clientBrand }: { issue: Issue; clientBrand: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [severity, setSeverity] = useState<IssueSeverity>(issue.severity);
  const [isExecutable, setIsExecutable] = useState(issue.isExecutable);
  const [assignedTo, setAssignedTo] = useState(issue.assignedTo ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"status" | "severity" | "assignee" | "note" | "executable" | null>(null);

  async function handleStatusChange(newStatus: IssueStatus) {
    setStatus(newStatus);
    setBusy("status");
    const supabase = createClient();
    await supabase
      .from("issues")
      .update({ status: newStatus, fixed_at: newStatus === "fixed" ? new Date().toISOString() : null })
      .eq("id", issue.id);
    await supabase.from("issue_activity").insert({
      issue_id: issue.id,
      client_id: issue.clientId,
      activity_type: "status_change",
      new_status: newStatus,
    });
    if (newStatus === "fixed") {
      await syncFixedIssueToReport(supabase, issue);
    }
    setBusy(null);
    router.refresh();
  }

  async function handleSeverityChange(newSeverity: IssueSeverity) {
    setSeverity(newSeverity);
    setBusy("severity");
    const supabase = createClient();
    await supabase.from("issues").update({ severity: newSeverity }).eq("id", issue.id);
    setBusy(null);
    router.refresh();
  }

  async function handleAssigneeBlur() {
    if (assignedTo === (issue.assignedTo ?? "")) return;
    setBusy("assignee");
    const supabase = createClient();
    await supabase
      .from("issues")
      .update({ assigned_to: assignedTo.trim() || null })
      .eq("id", issue.id);
    setBusy(null);
    router.refresh();
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setBusy("note");
    const supabase = createClient();
    await supabase.from("issue_activity").insert({
      issue_id: issue.id,
      client_id: issue.clientId,
      activity_type: "note",
      note: note.trim(),
    });
    setNote("");
    setBusy(null);
    router.refresh();
  }

  async function handleToggleExecutable() {
    setBusy("executable");
    const supabase = createClient();
    const next = !isExecutable;
    await supabase
      .from("issues")
      .update({ is_executable: next, executable_added_at: next ? new Date().toISOString() : issue.executableAddedAt })
      .eq("id", issue.id);
    await supabase.from("issue_activity").insert({
      issue_id: issue.id,
      client_id: issue.clientId,
      activity_type: next ? "added_to_executables" : "removed_from_executables",
    });
    setIsExecutable(next);
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/clients/${issue.clientId}`} className="text-xs font-semibold hover:underline">
                {clientBrand}
              </Link>
              <SeverityBadge severity={severity} />
              <select
                value={severity}
                onChange={(e) => handleSeverityChange(e.target.value as IssueSeverity)}
                disabled={busy === "severity"}
                aria-label="Priority"
                className="h-7 rounded-md border border-border bg-background px-1.5 text-xs"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">{ISSUE_CATEGORY_LABELS[issue.category]}</span>
              {isExecutable && (
                <Badge className="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                  In Executables
                </Badge>
              )}
            </div>
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="block max-w-md truncate text-sm font-medium hover:underline"
            >
              {issue.url}
            </a>
            <p className="text-sm text-muted-foreground">{issue.description}</p>
            <p className="text-xs text-muted-foreground">Detected {formatDate(issue.detectedAt)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
              disabled={busy === "status"}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={handleToggleExecutable} disabled={busy === "executable"}>
              {isExecutable ? "Remove from Executables" : "Add to Executables"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Assigned to
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              onBlur={handleAssigneeBlur}
              disabled={busy === "assignee"}
              placeholder="Unassigned"
              className="h-8 w-40 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            placeholder="Add a note…"
            className="h-8 min-w-[10rem] flex-1 rounded-md border border-border bg-background px-3 text-sm"
          />
          <Button size="sm" variant="secondary" onClick={handleAddNote} disabled={busy === "note" || !note.trim()}>
            {busy === "note" ? "Adding…" : "Add note"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewBoard({ issues, clients }: { issues: Issue[]; clients: Client[] }) {
  const [severity, setSeverity] = useState<IssueSeverity | "all">("all");
  const [clientId, setClientId] = useState<string>("all");
  const [status, setStatus] = useState<IssueStatus | "all">("open");
  const [type, setType] = useState<IssueType>("all");
  const [assignee, setAssignee] = useState<string>("all");

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c.brand])), [clients]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const i of issues) if (i.assignedTo) names.add(i.assignedTo);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [issues]);

  const filtered = useMemo(() => {
    return issues
      .filter((i) => severity === "all" || i.severity === severity)
      .filter((i) => clientId === "all" || i.clientId === clientId)
      .filter((i) => status === "all" || i.status === status)
      .filter((i) => type === "all" || categoryType(i.category) === type)
      .filter((i) => assignee === "all" || (assignee === UNASSIGNED ? !i.assignedTo : i.assignedTo === assignee))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [issues, severity, clientId, status, type, assignee]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Priority</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IssueSeverity | "all")}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="seo">SEO</option>
            <option value="security">Security</option>
            <option value="sprint">Sprint</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.brand}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IssueStatus | "all")}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="open">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="fixed">Completed</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Assignee</span>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {issues.length} issues
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching issues" description="Try a different filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <OverviewRow key={issue.id} issue={issue} clientBrand={clientById.get(issue.clientId) ?? "—"} />
          ))}
        </div>
      )}
    </div>
  );
}
