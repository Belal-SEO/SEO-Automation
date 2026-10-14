import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { ISSUE_CATEGORY_LABELS, type Issue, type TeamMember, type WorkHistoryPeriod } from "@/lib/types";

const PERIOD_OPTIONS: { value: WorkHistoryPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "lastWeek", label: "Previous week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export interface WorkHistoryData {
  memberId: string;
  hasDisplayName: boolean;
  period: WorkHistoryPeriod;
  page: number;
  pageSize: number;
  totalCount: number;
  issues: Issue[];
  clientBrandById: Record<string, string>;
}

/** Builds a /team href, applying `overrides` on top of the current search params; null removes a key. */
export function buildTeamHref(
  searchParams: Record<string, string | undefined>,
  overrides: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/team?${qs}` : "/team";
}

export function MemberWorkHistoryPanel({
  member,
  searchParams,
  data,
}: {
  member: TeamMember;
  searchParams: Record<string, string | undefined>;
  data: WorkHistoryData;
}) {
  if (!data.hasDisplayName) {
    return (
      <div className="ml-4 mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        Set a display name for {member.email} that matches the name used in &quot;Assigned to&quot; on tasks, to see
        their work history.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));

  return (
    <div className="ml-4 mt-2 space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={buildTeamHref(searchParams, { history: member.id, period: opt.value, page: "1" })}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              data.period === opt.value ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted",
            )}
          >
            {opt.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {data.totalCount} completed task{data.totalCount === 1 ? "" : "s"}
        </span>
      </div>

      {data.issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No completed tasks in this period.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.issues.map((issue) => (
            <li key={issue.id} className="space-y-0.5 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{data.clientBrandById[issue.clientId] ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{ISSUE_CATEGORY_LABELS[issue.category]}</span>
              </div>
              <p className="text-muted-foreground">{issue.description}</p>
              <p className="text-xs text-muted-foreground">Completed {formatDate(issue.fixedAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {data.totalCount > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <Link
            href={buildTeamHref(searchParams, {
              history: member.id,
              period: data.period,
              page: String(Math.max(1, data.page - 1)),
            })}
            aria-disabled={data.page <= 1}
            className={cn(
              "rounded-md border border-border px-2 py-1",
              data.page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted",
            )}
          >
            Previous
          </Link>
          <span className="text-muted-foreground">
            Page {data.page} of {totalPages}
          </span>
          <Link
            href={buildTeamHref(searchParams, {
              history: member.id,
              period: data.period,
              page: String(Math.min(totalPages, data.page + 1)),
            })}
            aria-disabled={data.page >= totalPages}
            className={cn(
              "rounded-md border border-border px-2 py-1",
              data.page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted",
            )}
          >
            Next
          </Link>
        </div>
      )}

      <Link
        href={buildTeamHref(searchParams, { history: null, period: null, page: null })}
        className="inline-block text-xs text-muted-foreground hover:underline"
      >
        Close
      </Link>
    </div>
  );
}
