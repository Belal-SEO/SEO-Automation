"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatMonthYear } from "@/lib/utils";
import { ISSUE_CATEGORY_LABELS, type Issue } from "@/lib/types";

function CompletedTaskRow({ task, showCategory }: { task: Issue; showCategory: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this completed task? This can't be undone.")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("issues").delete().eq("id", task.id);
    setDeleting(false);
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={task.severity} />
          {showCategory && (
            <span className="text-xs text-muted-foreground">{ISSUE_CATEGORY_LABELS[task.category]}</span>
          )}
          <span className="text-xs text-muted-foreground">Completed {formatDate(task.fixedAt)}</span>
        </div>
        <p>{task.description}</p>
        {task.assignedTo && <p className="text-xs text-muted-foreground">Assigned to {task.assignedTo}</p>}
      </div>
      <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Deleting…" : "Delete"}
      </Button>
    </li>
  );
}

/** Completed (status="fixed") tasks/issues, grouped by the month they were completed -- a running month-over-month history. */
export function CompletedTasksHistory({ tasks, showCategory = false }: { tasks: Issue[]; showCategory?: boolean }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No completed tasks yet"
        description="Tasks marked complete will show up here, grouped by month."
      />
    );
  }

  const sorted = [...tasks].sort(
    (a, b) => new Date(b.fixedAt ?? b.detectedAt).getTime() - new Date(a.fixedAt ?? a.detectedAt).getTime(),
  );
  const grouped = new Map<string, Issue[]>();
  for (const task of sorted) {
    const key = formatMonthYear(task.fixedAt ?? task.detectedAt);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([month, monthTasks]) => (
        <div key={month}>
          <h3 className="mb-2 text-sm font-semibold">{month}</h3>
          <ul className="space-y-2">
            {monthTasks.map((task) => (
              <CompletedTaskRow key={task.id} task={task} showCategory={showCategory} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
