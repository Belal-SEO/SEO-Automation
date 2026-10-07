"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import type { ClientRosterRow } from "@/lib/types";
import type { SprintTaskCompletion } from "@/lib/clientStage";

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

function SprintRow({
  client,
  completion,
  canEdit,
}: {
  client: ClientRosterRow;
  completion: SprintTaskCompletion;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [extendValue, setExtendValue] = useState(client.sprintDeadline ?? "");
  const [busy, setBusy] = useState<"extend" | "move" | null>(null);

  const daysLeft = client.sprintDeadline ? daysUntil(client.sprintDeadline) : null;
  const overdue = daysLeft != null && daysLeft < 0;

  async function handleExtend() {
    if (!extendValue) return;
    setBusy("extend");
    const supabase = createClient();
    await supabase.from("clients").update({ sprint_deadline: extendValue }).eq("id", client.id);
    setBusy(null);
    router.refresh();
  }

  async function handleMoveToLegacy() {
    if (!window.confirm(`Move ${client.brand} to Legacy now? This switches them to the crawl-audit pillar.`)) return;
    setBusy("move");
    const supabase = createClient();
    await supabase
      .from("clients")
      .update({ stage: "legacy", stage_changed_at: new Date().toISOString() })
      .eq("id", client.id);
    setBusy(null);
    router.refresh();
  }

  return (
    <Tr>
      <Td>
        <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
          {client.brand}
        </Link>
        <div className="text-xs text-muted-foreground">{client.name}</div>
      </Td>
      <Td className="text-muted-foreground">{client.domain}</Td>
      <Td>
        {client.sprintDeadline ? (
          <div className="space-y-0.5">
            <Badge
              className={cn(
                overdue
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                  : "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
              )}
            >
              {overdue ? `Overdue ${Math.abs(daysLeft!)}d` : `${daysLeft}d left`}
            </Badge>
            <div className="text-xs text-muted-foreground">Due {formatDate(client.sprintDeadline)}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No deadline set</span>
        )}
      </Td>
      <Td>
        <span className={completion.allComplete ? "font-medium text-emerald-600" : ""}>
          {completion.completedAssigned}/{completion.totalAssigned} done
        </span>
      </Td>
      <Td>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={extendValue}
              onChange={(e) => setExtendValue(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            />
            <Button size="sm" variant="secondary" onClick={handleExtend} disabled={busy === "extend" || !extendValue}>
              Extend
            </Button>
            <Button size="sm" variant="ghost" onClick={handleMoveToLegacy} disabled={busy === "move"}>
              Move to legacy
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </Td>
    </Tr>
  );
}

export function NewClientSprintTable({
  clients,
  completionByClient,
  canEdit = true,
}: {
  clients: ClientRosterRow[];
  completionByClient: Map<string, SprintTaskCompletion>;
  canEdit?: boolean;
}) {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Clinic</Th>
          <Th>Domain</Th>
          <Th>Sprint</Th>
          <Th>Assigned tasks</Th>
          <Th>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {clients.map((c) => (
          <SprintRow
            key={c.id}
            client={c}
            completion={
              completionByClient.get(c.id) ?? { totalAssigned: 0, completedAssigned: 0, allComplete: false }
            }
            canEdit={canEdit}
          />
        ))}
      </Tbody>
    </Table>
  );
}
