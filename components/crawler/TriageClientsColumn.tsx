"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { TriageClient } from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function TriageRow({ client, canManage }: { client: TriageClient; canManage: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("triage_clients").delete().eq("id", client.id);
    router.refresh();
  }

  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{client.clientName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(client.startDate)} → {formatDate(client.deadlineDate)}
        </p>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
          aria-label={`Remove ${client.clientName} from triage`}
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
      )}
    </li>
  );
}

export function TriageClientsColumn({
  clients,
  canManage = true,
}: {
  clients: TriageClient[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [deadlineDate, setDeadlineDate] = useState(todayIso());
  const [creating, setCreating] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !startDate || !deadlineDate) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("triage_clients").insert({
      client_name: clientName.trim(),
      start_date: startDate,
      deadline_date: deadlineDate,
    });
    setClientName("");
    setStartDate(todayIso());
    setDeadlineDate(todayIso());
    setCreating(false);
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Triage clients</h3>
        {canManage && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ Add client"}
          </Button>
        )}
      </div>

      {canManage && showForm && (
        <form onSubmit={handleAdd} className="mb-3 space-y-2 rounded-md border border-border p-3">
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client name"
            aria-label="Client name"
          />
          <div className="flex gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Start</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
              />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Deadline</span>
              <Input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                aria-label="Deadline"
              />
            </label>
          </div>
          <Button type="submit" size="sm" disabled={creating || !clientName.trim()} className="w-full">
            {creating ? "Adding…" : "Add to triage"}
          </Button>
        </form>
      )}

      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients in triage.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((client) => (
            <TriageRow key={client.id} client={client} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}
