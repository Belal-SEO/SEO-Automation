import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchMonthlyReportRoster } from "@/lib/monthlyReportQueries";
import { MonthlyReportRosterTable } from "@/components/monthlyreport/MonthlyReportRosterTable";
import { EmptyState } from "@/components/crawler/EmptyState";

export const dynamic = "force-dynamic";

export default async function MonthlyReportsPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const rows = await fetchMonthlyReportRoster(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Monthly Reports</h1>
        <p className="text-sm text-muted-foreground">
          Baseline, custom-range reports, and live GSC data per client — separate from the technical
          audit tool.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No clients yet" description="Add clients on the roster page first." />
      ) : (
        <MonthlyReportRosterTable rows={rows} />
      )}
    </div>
  );
}
