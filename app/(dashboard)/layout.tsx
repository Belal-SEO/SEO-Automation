import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/clients" className="font-semibold">
              SEO Audit Agent
            </Link>
            <Link href="/clients" className="text-muted-foreground hover:text-foreground">
              Clients
            </Link>
            <Link href="/coverage" className="text-muted-foreground hover:text-foreground">
              Coverage
            </Link>
          </nav>
          {user && <span className="text-xs text-muted-foreground">{user.email}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
