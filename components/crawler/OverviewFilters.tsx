"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Client } from "@/lib/types";

const UNASSIGNED = "__unassigned__";

export function OverviewFilters({
  clients,
  assigneeOptions,
  totalCount,
}: {
  clients: Client[];
  assigneeOptions: string[];
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const severity = searchParams.get("severity") ?? "all";
  const type = searchParams.get("type") ?? "all";
  const clientId = searchParams.get("client") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const assignee = searchParams.get("assignee") ?? "all";

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Priority</span>
        <select
          value={severity}
          onChange={(e) => setParam("severity", e.target.value)}
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
          onChange={(e) => setParam("type", e.target.value)}
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
          onChange={(e) => setParam("client", e.target.value)}
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
          onChange={(e) => setParam("status", e.target.value)}
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
          onChange={(e) => setParam("assignee", e.target.value)}
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
        {totalCount} issue{totalCount === 1 ? "" : "s"} match
      </span>
    </div>
  );
}
