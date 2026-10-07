"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { CompletedTasksHistory } from "@/components/crawler/CompletedTasksHistory";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { addSprintTask } from "@/lib/clientStage";
import { syncFixedIssueToReport } from "@/lib/issueReportSync";
import type { Issue, IssueSeverity, IssueStatus } from "@/lib/types";

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

const UNASSIGNED = "__unassigned__";

function TaskRow({
  task,
  canManagePriority,
  canDelete,
}: {
  task: Issue;
  canManagePriority: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<IssueStatus>(task.status);
  const [severity, setSeverity] = useState<IssueSeverity>(task.severity);
  const [assignedTo, setAssignedTo] = useState(task.assignedTo ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"status" | "severity" | "assignee" | "note" | "delete" | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    setBusy("delete");
    const supabase = createClient();
    await supabase.from("issues").delete().eq("id", task.id);
    router.refresh();
  }

  async function handleStatusChange(newStatus: IssueStatus) {
    setStatus(newStatus);
    setBusy("status");
    const supabase = createClient();
    await supabase
      .from("issues")
      .update({ status: newStatus, fixed_at: newStatus === "fixed" ? new Date().toISOString() : null })
      .eq("id", task.id);
    await supabase.from("issue_activity").insert({
      issue_id: task.id,
      client_id: task.clientId,
      activity_type: "status_change",
      new_status: newStatus,
    });
    if (newStatus === "fixed") {
      await syncFixedIssueToReport(supabase, task);
    }
    setBusy(null);
    router.refresh();
  }

  async function handleSeverityChange(newSeverity: IssueSeverity) {
    setSeverity(newSeverity);
    setBusy("severity");
    const supabase = createClient();
    await supabase.from("issues").update({ severity: newSeverity }).eq("id", task.id);
    setBusy(null);
    router.refresh();
  }

  async function handleAssigneeBlur() {
    if (assignedTo === (task.assignedTo ?? "")) return;
    setBusy("assignee");
    const supabase = createClient();
    await supabase
      .from("issues")
      .update({ assigned_to: assignedTo.trim() || null })
      .eq("id", task.id);
    setBusy(null);
    router.refresh();
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setBusy("note");
    const supabase = createClient();
    await supabase.from("issue_activity").insert({
      issue_id: task.id,
      client_id: task.clientId,
      activity_type: "note",
      note: note.trim(),
    });
    setNote("");
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
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
              <span className="text-xs text-muted-foreground">Added {formatDate(task.detectedAt)}</span>
            </div>
            <p className="text-sm">{task.description}</p>
          </div>
          <div className="flex items-center gap-2">
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
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy === "delete"}>
                {busy === "delete" ? "Deleting…" : "Delete"}
              </Button>
            )}
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

export function SprintTasksBoard({
  clientId,
  clientDomain,
  tasks,
  canManagePriority = true,
  canDelete = true,
}: {
  clientId: string;
  clientDomain: string;
  tasks: Issue[];
  canManagePriority?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "fixed"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "fixed"), [tasks]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of activeTasks) if (t.assignedTo) names.add(t.assignedTo);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [activeTasks]);

  const filteredTasks = useMemo(
    () =>
      activeTasks.filter(
        (t) =>
          filterAssignee === "all" || (filterAssignee === UNASSIGNED ? !t.assignedTo : t.assignedTo === filterAssignee),
      ),
    [activeTasks, filterAssignee],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setCreating(true);
    const supabase = createClient();
    await addSprintTask(supabase, clientId, clientDomain, {
      description: description.trim(),
      severity,
      assignedTo: assignedTo.trim() || null,
    });
    setDescription("");
    setAssignedTo("");
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">New task</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task…"
          />
        </div>
        {canManagePriority && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Assign to</label>
          <Input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Optional"
            className="w-40"
          />
        </div>
        <Button type="submit" size="sm" disabled={creating || !description.trim()}>
          {creating ? "Adding…" : "Add task"}
        </Button>
      </form>

      {activeTasks.length === 0 ? (
        <EmptyState title="No active tasks" description="Add the first sprint task above." />
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Assignee</span>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
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
          {filteredTasks.length === 0 ? (
            <EmptyState title="No matching tasks" description="Try a different assignee filter." />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskRow key={task.id} task={task} canManagePriority={canManagePriority} canDelete={canDelete} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Completed tasks</h3>
        <CompletedTasksHistory tasks={completedTasks} />
      </div>
    </div>
  );
}
