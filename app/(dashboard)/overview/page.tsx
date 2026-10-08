import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapClient, mapIssue } from "@/lib/queries";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import { OverviewBoard } from "@/components/crawler/OverviewBoard";
import { OverviewFilters } from "@/components/crawler/OverviewFilters";
import { EmptyState } from "@/components/crawler/EmptyState";
import { cn } from "@/lib/utils";
import {
  SECURITY_ISSUE_CATEGORIES,
  SPRINT_ISSUE_CATEGORIES,
  SEO_ISSUE_CATEGORIES,
  type IssueTypeFilter,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const UNASSIGNED = "__unassigned__";

const TYPE_CATEGORY_MAP: Record<Exclude<IssueTypeFilter, "all">, string[]> = {
  seo: SEO_ISSUE_CATEGORIES,
  security: SECURITY_ISSUE_CATEGORIES,
  sprint: SPRINT_ISSUE_CATEGORIES,
};

function buildHref(searchParams: Record<string, string | undefined>, overrides: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    params.set(key, value);
  }
  return `/overview?${params.toString()}`;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    severity?: string;
    type?: string;
    client?: string;
    status?: string;
    assignee?: string;
  };
}) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const role = await getCurrentTeamRole(supabase);
  const isAdmin = role === "admin";

  const { data: clientRows } = await supabase.from("clients").select("*").eq("active", true).order("brand");
  const clients = (clientRows ?? []).map(mapClient);
  const clientIds = clients.map((c) => c.id);

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const severity = searchParams.severity ?? "all";
  const type = (searchParams.type ?? "all") as IssueTypeFilter;
  const clientFilter = searchParams.client ?? "all";
  const status = searchParams.status ?? "all";
  const assignee = searchParams.assignee ?? "all";

  let issues: ReturnType<typeof mapIssue>[] = [];
  let totalCount = 0;
  let assigneeOptions: string[] = [];

  if (clientIds.length > 0) {
    let query = supabase.from("issues").select("*", { count: "exact" }).in("client_id", clientIds);
    if (clientFilter !== "all") query = query.eq("client_id", clientFilter);
    if (severity !== "all") query = query.eq("severity", severity);
    if (status !== "all") query = query.eq("status", status);
    if (type !== "all") query = query.in("category", TYPE_CATEGORY_MAP[type]);
    if (assignee === UNASSIGNED) query = query.is("assigned_to", null);
    else if (assignee !== "all") query = query.eq("assigned_to", assignee);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: issueRows, count } = await query.order("detected_at", { ascending: false }).range(from, to);

    issues = (issueRows ?? []).map(mapIssue);
    totalCount = count ?? 0;

    const { data: assigneeRows } = await supabase
      .from("issues")
      .select("assigned_to")
      .in("client_id", clientIds)
      .not("assigned_to", "is", null);
    assigneeOptions = Array.from(new Set((assigneeRows ?? []).map((r) => r.assigned_to as string))).sort((a, b) =>
      a.localeCompare(b),
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Every issue across every client — crawl-detected technical/SEO issues, security findings, and sprint
          tasks — in one queue. Filter it, assign it, and track it through to done.
        </p>
      </div>

      <OverviewFilters clients={clients} assigneeOptions={assigneeOptions} totalCount={totalCount} />

      {issues.length === 0 ? (
        <EmptyState title="No matching issues" description="Try a different filter." />
      ) : (
        <>
          <OverviewBoard issues={issues} clients={clients} canManagePriority={isAdmin} canDelete={isAdmin} />

          <div className="flex items-center justify-between gap-3 text-sm">
            <Link
              href={buildHref(searchParams, { page: String(Math.max(1, page - 1)) })}
              aria-disabled={page <= 1}
              className={cn(
                "rounded-md border border-border px-3 py-1.5 text-sm",
                page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted",
              )}
            >
              Previous
            </Link>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Link
              href={buildHref(searchParams, { page: String(Math.min(totalPages, page + 1)) })}
              aria-disabled={page >= totalPages}
              className={cn(
                "rounded-md border border-border px-3 py-1.5 text-sm",
                page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted",
              )}
            >
              Next
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
