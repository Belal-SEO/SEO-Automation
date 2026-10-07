import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import type { TeamRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

/** Looks up the signed-in user's role from team_members by email. Null = not provisioned (no dashboard access at all). */
export async function getCurrentTeamRole(supabase: SupabaseClient<Database>): Promise<TeamRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) return null;

  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data?.role as TeamRole | undefined) ?? null;
}

/**
 * For API routes that use the service-role client (which bypasses RLS) --
 * explicitly checks the caller's own cookie-bound session/role, since RLS
 * can't protect those routes. Returns a 403 response if not an admin,
 * otherwise null (caller proceeds).
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = createClient();
  const role = await getCurrentTeamRole(supabase);
  if (role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return null;
}
