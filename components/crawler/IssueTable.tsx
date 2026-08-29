"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { SeverityBadge } from "@/components/crawler/SeverityBadge";
import { EmptyState } from "@/components/crawler/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  ISSUE_CATEGORY_LABELS,
  SEVERITY_ORDER,
  type Issue,
  type IssueCategory,
  type IssueStatus,
} from "@/lib/types";

export function IssueTable({ issues }: { issues: Issue[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<IssueCategory | "all">("all");
  const [status, setStatus] = useState<IssueStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    return issues
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => status === "all" || i.status === status)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [issues, category, status]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddToExecutables() {
    if (selected.size === 0) return;
    setAdding(true);
    const supabase = createClient();
    const ids = Array.from(selected);
    const now = new Date().toISOString();

    await supabase
      .from("issues")
      .update({ is_executable: true, executable_added_at: now })
      .in("id", ids);

    await supabase.from("issue_activity").insert(
      ids.map((issueId) => {
        const issue = issues.find((i) => i.id === issueId)!;
        return {
          issue_id: issueId,
          client_id: issue.clientId,
          activity_type: "added_to_executables" as const,
        };
      }),
    );

    setAdding(false);
    setSelected(new Set());
    router.refresh();
  }

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
              <option value="fixed">Fixed</option>
            </select>
          </label>
        </div>
        {selected.size > 0 && (
          <Button size="sm" onClick={handleAddToExecutables} disabled={adding}>
            {adding ? "Adding…" : `Add ${selected.size} to Executables`}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching issues" description="Try a different category or status filter." />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th className="w-8" />
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
                  {issue.isExecutable ? (
                    <Badge className="border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                      In Executables
                    </Badge>
                  ) : (
                    <input
                      type="checkbox"
                      checked={selected.has(issue.id)}
                      onChange={() => toggleSelected(issue.id)}
                      aria-label={`Select issue: ${issue.description}`}
                      className="h-4 w-4"
                    />
                  )}
                </Td>
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
