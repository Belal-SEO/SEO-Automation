"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { syncFixedIssueToReport } from "@/lib/issueReportSync";
import { ISSUE_CATEGORY_LABELS, type Issue, type IssueSeverity, type IssueStatus } from "@/lib/types";

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "fixed", label: "Completed" },
];

function IssueRow({
  issue,
  canManagePriority,
  canManageDueDate,
  canDelete,
}: {
  issue: Issue;
  canManagePriority: boolean;
  canManageDueDate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [severity, setSeverity] = useState<IssueSeverity>(issue.severity);
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [assignedTo, setAssignedTo] = useState(issue.assignedTo ?? "");
  const [dueDate, setDueDate] = useState(issue.dueDate ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"severity" | "status" | "assignee" | "dueDate" | "note" | "delete" | null>(null);

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

  async function handleDueDateChange(newDate: string) {
    setDueDate(newDate);
    setBusy("dueDate");
    const supabase = createClient();
    await supabase
      .from("issues")
      .update({ due_date: newDate || null })
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
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Detected {formatDate(issue.detectedAt)}</span>
            {canManageDueDate ? (
              <label className="flex items-center gap-1">
                Due
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  disabled={busy === "dueDate"}
                  className="h-6 rounded-md border border-border bg-background px-1 text-xs text-foreground"
                />
              </label>
            ) : (
              <span>Due {dueDate ? formatDate(dueDate) : "—"}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
            disabled={busy === "status"}
            aria-label="Status"
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy === "delete"}>
              {busy === "delete" ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
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
    </li>
  );
}

export function IssueTable({
  issues,
  canManagePriority = true,
  canManageDueDate = true,
  canDelete = true,
}: {
  issues: Issue[];
  canManagePriority?: boolean;
  canManageDueDate?: boolean;
  canDelete?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <IssueRow
          key={issue.id}
          issue={issue}
          canManagePriority={canManagePriority}
          canManageDueDate={canManageDueDate}
          canDelete={canDelete}
        />
      ))}
    </ul>
  );
}
