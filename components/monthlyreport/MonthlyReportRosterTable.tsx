import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { MonthlyReportRosterRow } from "@/lib/monthlyReportTypes";

const STATUS_STYLES: Record<string, string> = {
  sent: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  approved: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  in_review: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  draft: "border-border bg-muted text-muted-foreground",
  none: "border-border bg-muted text-muted-foreground",
};

export function MonthlyReportRosterTable({ rows }: { rows: MonthlyReportRosterRow[] }) {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Clinic</Th>
          <Th>Setup</Th>
          <Th>Last report</Th>
          <Th>Status</Th>
          <Th>Next scheduled send</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row) => (
          <Tr key={row.clientId}>
            <Td>
              <Link href={`/clients/${row.clientId}/monthly-reports`} className="font-medium hover:underline">
                {row.brand}
              </Link>
            </Td>
            <Td>
              {row.hasSettings && row.hasBaseline ? (
                <span className="text-xs text-muted-foreground">Ready</span>
              ) : (
                <span className="text-xs text-amber-600">
                  {!row.hasBaseline && !row.hasSettings
                    ? "Needs baseline + settings"
                    : !row.hasBaseline
                      ? "Needs baseline"
                      : "Needs settings"}
                </span>
              )}
            </Td>
            <Td className="text-muted-foreground">{row.lastReportPeriodLabel ?? "—"}</Td>
            <Td>
              <Badge className={cn(STATUS_STYLES[row.lastReportStatus ?? "none"] ?? STATUS_STYLES.none, "capitalize")}>
                {(row.lastReportStatus ?? "none").replace("_", " ")}
              </Badge>
            </Td>
            <Td className="text-muted-foreground">{formatDate(row.nextScheduledSendDate)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
