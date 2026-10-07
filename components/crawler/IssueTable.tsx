"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { CompletedTasksHistory } from "@/components/crawler/CompletedTasksHistory";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  ISSUE_CATEGORY_LABELS,
  SEVERITY_ORDER,
  type Issue,
  type IssueCategory,
  type IssueSeverity,
  type IssueStatus,
} from "@/lib/types";

const UNASSIGNED = "__unassigned__";

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function IssueRow({
  issue,
  canManagePriority,
  canDelete,
}: {
  issue: Issue;
  canManagePriority: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [severity, setSeverity] = useState<IssueSeverity>(issue.severity);
  const [assignedTo, setAssignedTo] = useState(issue.assignedTo ?? "");
  const [busy, setBusy] = useState<"severity" | "assignee" | "delete" | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this issue? This can't be undone.")) return;
    setBusy("delete");
    const supabase = createClient();
    await supabase.from("issues").delete().eq("id", issue.id);
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

  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={severity} />
            {canManagePriority && (
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
            )}
            <span className="text-xs text-muted-foreground">{ISSUE_CATEGORY_LABELS[issue.category]}</span>
            <span className="text-xs capitalize text-muted-foreground">{issue.status.replace("_", " ")}</span>
          </div>
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full truncate text-sm font-medium hover:underline"
          >
            {issue.url}
          </a>
          <p className="text-sm text-muted-foreground">{issue.description}</p>
          <p className="text-xs text-muted-foreground">Detected {formatDate(issue.detectedAt)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Assigned to
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              onBlur={handleAssigneeBlur}
              disabled={busy === "assignee"}
              placeholder="Unassigned"
              className="h-7 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy === "delete"}>
              {busy === "delete" ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function IssueTable({
  issues,
  canManagePriority = true,
  canDelete = true,
}: {
  issues: Issue[];
  canManagePriority?: boolean;
  canDelete?: boolean;
}) {
  const [category, setCategory] = useState<IssueCategory | "all">("all");
  const [status, setStatus] = useState<IssueStatus | "all">("all");
  const [assignee, setAssignee] = useState<string>("all");

  const activeIssues = useMemo(() => issues.filter((i) => i.status !== "fixed"), [issues]);
  const completedIssues = useMemo(() => issues.filter((i) => i.status === "fixed"), [issues]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const i of activeIssues) if (i.assignedTo) names.add(i.assignedTo);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [activeIssues]);

  const filtered = useMemo(() => {
    return activeIssues
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => status === "all" || i.status === status)
      .filter((i) => assignee === "all" || (assignee === UNASSIGNED ? !i.assignedTo : i.assignedTo === assignee))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [activeIssues, category, status, assignee]);

  if (issues.length === 0) {
    return <EmptyState title="No issues found" description="This audit didn't surface any technical issues." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory | "all")}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="all">All</option>
              {Object.entries(ISSUE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching issues" description="Try a different filter." />
      ) : (
        <ul className="space-y-3">
          {filtered.map((issue) => (
            <IssueRow key={issue.id} issue={issue} canManagePriority={canManagePriority} canDelete={canDelete} />
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Completed issues</h3>
        <CompletedTasksHistory tasks={completedIssues} showCategory />
      </div>
    </div>
  );
}
