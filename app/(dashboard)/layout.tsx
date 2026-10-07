import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/crawler/SupabaseSetupNotice";
import { SignOutButton } from "@/components/crawler/SignOutButton";
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
    <div className="min-h-screen">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/clients" className="font-semibold">
              SEO Audit Agent
            </Link>
            <Link href="/clients" className="text-muted-foreground hover:text-foreground">
              Clients
            </Link>
            {role === "admin" && (
              <>
                <Link href="/coverage" className="text-muted-foreground hover:text-foreground">
                  Coverage
                </Link>
                <Link href="/monthly-reports" className="text-muted-foreground hover:text-foreground">
                  Monthly Reports
                </Link>
                <Link href="/team" className="text-muted-foreground hover:text-foreground">
                  Team
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-muted-foreground">
                {user.email} · <span className="capitalize">{role}</span>
              </span>
            )}
            {user && <SignOutButton />}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
