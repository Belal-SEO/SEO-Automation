import { createClient } from "@/lib/supabase/server";
import { fetchClientRoster } from "@/lib/queries";
import { CoverageOverview } from "@/components/crawler/CoverageOverview";
import { EmptyState } from "@/components/crawler/EmptyState";

export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const supabase = createClient();
  const roster = await fetchClientRoster(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Coverage overview</h1>
        <p className="text-sm text-muted-foreground">
          Agency-wide view of who got a report this cycle and who&apos;s overdue.
        </p>
      </div>

      {roster.length === 0 ? (
        <EmptyState title="No clients yet" description="Add clients on the roster page to see coverage here." />
      ) : (
        <CoverageOverview clients={roster} />
      )}
    </div>
  );
}
