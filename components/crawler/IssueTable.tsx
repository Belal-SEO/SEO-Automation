"use client";

import { useMemo, useState } from "react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { formatDate } from "@/lib/utils";
import {
  ISSUE_CATEGORY_LABELS,
  SEVERITY_ORDER,
  type Issue,
  type IssueCategory,
  type IssueStatus,
} from "@/lib/types";

export function IssueTable({ issues }: { issues: Issue[] }) {
  const [category, setCategory] = useState<IssueCategory | "all">("all");
  const [status, setStatus] = useState<IssueStatus | "all">("all");

  const filtered = useMemo(() => {
    return issues
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => status === "all" || i.status === status)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [issues, category, status]);

  if (issues.length === 0) {
    return <EmptyState title="No issues found" description="This audit didn't surface any technical issues." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm">
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
            <option value="fixed">Fixed</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching issues" description="Try a different category or status filter." />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Severity</Th>
              <Th>Category</Th>
              <Th>Page</Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>Detected</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((issue) => (
              <Tr key={issue.id}>
                <Td>
                  <SeverityBadge severity={issue.severity} />
                </Td>
                <Td>{ISSUE_CATEGORY_LABELS[issue.category]}</Td>
                <Td className="max-w-xs truncate">
                  <a href={issue.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {issue.url}
                  </a>
                </Td>
                <Td className="max-w-sm text-muted-foreground">{issue.description}</Td>
                <Td className="capitalize">{issue.status.replace("_", " ")}</Td>
                <Td className="text-muted-foreground">{formatDate(issue.detectedAt)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
