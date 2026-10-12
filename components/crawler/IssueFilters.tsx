"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ISSUE_CATEGORY_LABELS, type IssueCategory } from "@/lib/types";

const UNASSIGNED = "__unassigned__";

const CATEGORY_OPTIONS = Object.entries(ISSUE_CATEGORY_LABELS).filter(
  ([value]) => value !== "sprint_task",
) as [IssueCategory, string][];

export function IssueFilters({ assigneeOptions, totalCount }: { assigneeOptions: string[]; totalCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("issuesPage");
    router.push(`${pathname}?${params.toString()}`);
  }

  const category = searchParams.get("issuesCategory") ?? "all";
  const status = searchParams.get("issuesStatus") ?? "all";
  const assignee = searchParams.get("issuesAssignee") ?? "all";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Category</span>
          <select
            value={category}
            onChange={(e) => setParam("issuesCategory", e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
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
            onChange={(e) => setParam("issuesStatus", e.target.value)}
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
            onChange={(e) => setParam("issuesAssignee", e.target.value)}
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
      <span className="text-xs text-muted-foreground">
        {totalCount} issue{totalCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
