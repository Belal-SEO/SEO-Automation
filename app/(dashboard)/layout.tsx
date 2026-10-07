import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/crawler/SupabaseSetupNotice";
import { SignOutButton } from "@/components/crawler/SignOutButton";
import { Sidebar } from "@/components/crawler/Sidebar";
import { getCurrentTeamRole } from "@/lib/teamAccess";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user ? await getCurrentTeamRole(supabase) : null;

  if (user && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-lg font-semibold">Access pending</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} hasn&apos;t been added to the team yet. Ask an admin to add you on the Team page.
          </p>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {user && role && <Sidebar isAdmin={role === "admin"} userEmail={user.email ?? ""} role={role} />}
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
