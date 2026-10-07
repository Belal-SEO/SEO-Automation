import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentTeamRole } from "@/lib/teamAccess";
import { fetchTeamMembers } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TeamMembersPanel } from "@/components/crawler/TeamMembersPanel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getCurrentTeamRole(supabase);
  if (role !== "admin" || !user) redirect("/clients");

  const members = await fetchTeamMembers(supabase);

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
          <TeamMembersPanel members={members} currentUserEmail={user.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
