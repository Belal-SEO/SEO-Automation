import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import { fetchTeamMembers, fetchMemberWorkHistory } from "@/lib/queries";
import { getWorkHistoryPeriodRange } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TeamMembersPanel } from "@/components/crawler/TeamMembersPanel";
import type { WorkHistoryData } from "@/components/crawler/MemberWorkHistoryPanel";
import type { WorkHistoryPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 10;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: { history?: string; period?: string; page?: string };
}) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getCurrentTeamRole(supabase);
  if (role !== "admin" || !user) redirect("/clients");

  const members = await fetchTeamMembers(supabase);

  let workHistory: WorkHistoryData | null = null;
  if (searchParams.history) {
    const member = members.find((m) => m.id === searchParams.history);
    if (member) {
      const period = (searchParams.period as WorkHistoryPeriod) || "week";
      const historyPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
      const name = member.displayName?.trim();

      if (name) {
        const { issues, clientBrandById, totalCount } = await fetchMemberWorkHistory(
          supabase,
          name,
          getWorkHistoryPeriodRange(period),
          historyPage,
          HISTORY_PAGE_SIZE,
        );
        workHistory = {
          memberId: member.id,
          hasDisplayName: true,
          period,
          page: historyPage,
          pageSize: HISTORY_PAGE_SIZE,
          totalCount,
          issues,
          clientBrandById,
        };
      } else {
        workHistory = {
          memberId: member.id,
          hasDisplayName: false,
          period,
          page: 1,
          pageSize: HISTORY_PAGE_SIZE,
          totalCount: 0,
          issues: [],
          clientBrandById: {},
        };
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">Who can sign in, and what they can do.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Admins have full access, including adding more admins. Editors can only see the client roster and work
            the task boards — they can&apos;t change a task&apos;s priority, delete anything, add or edit clients,
            or view Coverage / Monthly Reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersPanel
            members={members}
            currentUserEmail={user.email ?? ""}
            searchParams={searchParams}
            workHistory={workHistory}
          />
        </CardContent>
      </Card>
    </div>
  );
}
