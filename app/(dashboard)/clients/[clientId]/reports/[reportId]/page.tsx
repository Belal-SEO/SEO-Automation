import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapClient, mapReport } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportDraftEditor } from "@/components/crawler/ReportDraftEditor";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: { clientId: string; reportId: string };
}) {
  const supabase = createClient();

  const [{ data: clientRow }, { data: reportRow }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase
      .from("reports")
      .select("*")
      .eq("id", params.reportId)
      .eq("client_id", params.clientId)
      .maybeSingle(),
  ]);

  if (!clientRow || !reportRow) notFound();

  const client = mapClient(clientRow);
  const report = mapReport(reportRow);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{client.brand} — report draft</h1>
        <p className="text-sm text-muted-foreground">
          Period: {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Draft content</CardTitle>
          <CardDescription>
            Grounded in stored audit data. Review before approving — nothing sends without your sign-off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportDraftEditor report={report} />
        </CardContent>
      </Card>
    </div>
  );
}
