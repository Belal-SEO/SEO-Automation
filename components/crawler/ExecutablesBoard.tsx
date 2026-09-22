"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { syncFixedIssueToReport } from "@/lib/issueReportSync";
import { ISSUE_CATEGORY_LABELS, type Issue, type IssueSeverity, type IssueStatus } from "@/lib/types";

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

function ExecutableRow({ issue }: { issue: Issue }) {
  const router = useRouter();
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [severity, setSeverity] = useState<IssueSeverity>(issue.severity);
  const [assignedTo, setAssignedTo] = useState(issue.assignedTo ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"status" | "severity" | "assignee" | "note" | "remove" | null>(null);

  async function handleStatusChange(newStatus: IssueStatus) {
    setStatus(newStatus);
    setBusy("status");
    const supabase = createClient();
    await supabase
      .from("issues")
      .update({
        status: newStatus,
        fixed_at: newStatus === "fixed" ? new Date().toISOString() : null,
      })
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

  async function handleRemove() {
    setBusy("remove");
    const supabase = createClient();
    await supabase.from("issues").update({ is_executable: false }).eq("id", issue.id);
    await supabase.from("issue_activity").insert({
      issue_id: issue.id,
      client_id: issue.clientId,
      activity_type: "removed_from_executables",
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
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
            <p className="text-xs text-muted-foreground">
              Added to Executables {formatDate(issue.executableAddedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
            <Button size="sm" variant="ghost" onClick={handleRemove} disabled={busy === "remove"}>
              Remove
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
            placeholder="Add a note (e.g. what was done, who's handling it)…"
            className="h-8 w-full flex-1 min-w-[10rem] rounded-md border border-border bg-background px-3 text-sm"
          />
          <Button size="sm" variant="secondary" onClick={handleAddNote} disabled={busy === "note" || !note.trim()}>
            {busy === "note" ? "Adding…" : "Add note"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExecutablesBoard({ issues }: { issues: Issue[] }) {
  const [assignee, setAssignee] = useState<string>("all");

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const i of issues) if (i.assignedTo) names.add(i.assignedTo);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [issues]);

  const filtered = useMemo(
    () =>
      issues.filter(
        (i) => assignee === "all" || (assignee === UNASSIGNED ? !i.assignedTo : i.assignedTo === assignee),
      ),
    [issues, assignee],
  );

  if (issues.length === 0) {
    return (
      <EmptyState
        title="No Executables yet"
        description="Select issues from the audit list on the client page and click “Add to Executables” to start this cycle's work queue."
      />
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
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

      {filtered.length === 0 ? (
        <EmptyState title="No matching tasks" description="Try a different assignee filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <ExecutableRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
