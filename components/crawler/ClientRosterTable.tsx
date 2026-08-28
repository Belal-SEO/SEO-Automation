import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { ClientRosterRow } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  sent: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  approved: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  draft: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  overdue: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  none: "border-border bg-muted text-muted-foreground",
};

export function ClientRosterTable({ clients }: { clients: ClientRosterRow[] }) {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Clinic</Th>
          <Th>Domain</Th>
          <Th>Last audit</Th>
          <Th>Open issues</Th>
          <Th>Report status</Th>
        </Tr>
      </Thead>
      <Tbody>
        {clients.map((c) => (
          <Tr key={c.id}>
            <Td>
              <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                {c.brand}
              </Link>
              <div className="text-xs text-muted-foreground">{c.name}</div>
            </Td>
            <Td className="text-muted-foreground">{c.domain}</Td>
            <Td>{formatDate(c.lastAuditAt)}</Td>
            <Td>
              <span className={c.openIssueCount > 0 ? "font-medium" : "text-muted-foreground"}>
                {c.openIssueCount}
              </span>
            </Td>
            <Td>
              <Badge className={cn(STATUS_STYLES[c.latestReportStatus] ?? STATUS_STYLES.none, "capitalize")}>
                {c.latestReportStatus}
              </Badge>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
