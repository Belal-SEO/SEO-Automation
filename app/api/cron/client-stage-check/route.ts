import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { computeSprintTaskCompletion, moveClientToLegacy } from "@/lib/clientStage";

/**
 * Scheduled entry point (see vercel.json). For every "new" client whose
 * 90-day sprint_deadline has passed, graduates them to "legacy" only if
 * every task ever assigned to someone is fixed. Otherwise leaves them in
 * place (overdue) for a human to extend the deadline or move them anytime
 * from the client roster page -- this cron never forces a move on
 * incomplete work.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const todayUtc = new Date().toISOString().slice(0, 10);

  const { data: candidates, error } = await supabase
    .from("clients")
    .select("id, brand")
    .eq("stage", "new")
    .lte("sprint_deadline", todayUtc);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const graduated: string[] = [];
  const stillOverdue: { clientId: string; totalAssigned: number; completedAssigned: number }[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const client of candidates ?? []) {
    try {
      const completion = await computeSprintTaskCompletion(supabase, client.id);
      if (completion.allComplete) {
        await moveClientToLegacy(supabase, client.id);
        graduated.push(client.id);
      } else {
        stillOverdue.push({
          clientId: client.id,
          totalAssigned: completion.totalAssigned,
          completedAssigned: completion.completedAssigned,
        });
      }
    } catch (err) {
      failed.push({ clientId: client.id, error: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  return NextResponse.json({ graduated, stillOverdue, failed });
}
