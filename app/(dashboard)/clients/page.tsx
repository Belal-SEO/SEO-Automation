import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchClientRoster } from "@/lib/queries";
import { ClientRosterTable } from "@/components/crawler/ClientRosterTable";
import { ClientForm } from "@/components/crawler/ClientForm";
import { EmptyState } from "@/components/crawler/EmptyState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = createClient();
  const roster = await fetchClientRoster(supabase);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Client roster</h1>
        <p className="text-sm text-muted-foreground">
          Who&apos;s due for a crawl, who has open issues, and who&apos;s waiting on a report.
        </p>
      </div>

      {roster.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add your first clinic to start running technical audits."
        />
      ) : (
        <ClientRosterTable clients={roster} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add a client</CardTitle>
          <CardDescription>Reconcile brand and locations against the master client DB.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
