"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import type { Client } from "@/lib/types";
import type { SprintTaskCompletion } from "@/lib/clientStage";

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

export function SprintStatusPanel({ client, completion }: { client: Client; completion: SprintTaskCompletion }) {
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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {client.sprintDeadline && (
          <Badge
            className={cn(
              overdue
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                : "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
            )}
          >
            {overdue ? `Sprint overdue ${Math.abs(daysLeft!)}d` : `${daysLeft}d left in sprint`}
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {client.sprintDeadline ? `Due ${formatDate(client.sprintDeadline)}` : "No sprint deadline set"} ·{" "}
          <span className={completion.allComplete ? "font-medium text-emerald-600" : ""}>
            {completion.completedAssigned}/{completion.totalAssigned} assigned tasks done
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={extendValue}
          onChange={(e) => setExtendValue(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        />
        <Button size="sm" variant="secondary" onClick={handleExtend} disabled={busy === "extend" || !extendValue}>
          Extend sprint
        </Button>
        <Button size="sm" variant="ghost" onClick={handleMoveToLegacy} disabled={busy === "move"}>
          Move to legacy now
        </Button>
      </div>
    </div>
  );
}
