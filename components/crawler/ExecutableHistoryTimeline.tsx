import { EmptyState } from "@/components/crawler/EmptyState";
import type { Issue, IssueActivity } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  open: "Not started",
  in_progress: "In progress",
  fixed: "Completed",
};

function describeActivity(activity: IssueActivity): string {
  switch (activity.activityType) {
    case "added_to_executables":
      return "Added to Executables";
    case "removed_from_executables":
      return "Removed from Executables";
    case "status_change":
      return `Status changed to ${STATUS_LABELS[activity.newStatus ?? ""] ?? activity.newStatus}`;
    case "note":
      return `Note: ${activity.note}`;
    default:
      return activity.activityType;
  }
}

function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

export function ExecutableHistoryTimeline({
  activity,
  issuesById,
}: {
  activity: IssueActivity[];
  issuesById: Map<string, Issue>;
}) {
  if (activity.length === 0) {
    return (
      <EmptyState
        title="No history yet"
        description="Status changes and notes on Executables will show up here, grouped by month, as work happens."
      />
    );
  }

  const sorted = [...activity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const grouped = new Map<string, IssueActivity[]>();
  for (const item of sorted) {
    const key = monthKey(item.createdAt);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([month, entries]) => (
        <div key={month}>
          <h3 className="mb-2 text-sm font-semibold">{month}</h3>
          <ul className="space-y-2 border-l border-border pl-4">
            {entries.map((entry) => {
              const issue = issuesById.get(entry.issueId);
              return (
                <li key={entry.id} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span>{describeActivity(entry)}</span>
                  </div>
                  {issue && (
                    <p className="truncate text-xs text-muted-foreground" title={issue.url}>
                      {issue.url} — {issue.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
