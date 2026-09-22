import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { IssueSeverity } from "@/lib/types";

type SupabaseDb = SupabaseClient<Database>;

export const SPRINT_LENGTH_DAYS = 90;

export function computeSprintDeadline(from: Date = new Date()): string {
  const deadline = new Date(from);
  deadline.setUTCDate(deadline.getUTCDate() + SPRINT_LENGTH_DAYS);
  return deadline.toISOString().slice(0, 10);
}

export interface SprintTaskCompletion {
  totalAssigned: number;
  completedAssigned: number;
  allComplete: boolean;
}

/**
 * Every issue assigned to someone for this client must be fixed for the
 * sprint to count as done -- a client with zero assigned tasks never
 * auto-completes, since that would graduate a client nobody actually
 * worked on.
 */
export async function computeSprintTaskCompletion(
  supabase: SupabaseDb,
  clientId: string,
): Promise<SprintTaskCompletion> {
  const { data, error } = await supabase
    .from("issues")
    .select("status")
    .eq("client_id", clientId)
    .not("assigned_to", "is", null);
  if (error) throw error;

  const rows = data ?? [];
  const totalAssigned = rows.length;
  const completedAssigned = rows.filter((r) => r.status === "fixed").length;
  return {
    totalAssigned,
    completedAssigned,
    allComplete: totalAssigned > 0 && completedAssigned === totalAssigned,
  };
}

/** Batched version of computeSprintTaskCompletion for the roster page -- one query instead of one per client. */
export async function fetchSprintTaskCompletionByClient(
  supabase: SupabaseDb,
  clientIds: string[],
): Promise<Map<string, SprintTaskCompletion>> {
  const map = new Map<string, SprintTaskCompletion>();
  if (clientIds.length === 0) return map;

  const { data, error } = await supabase
    .from("issues")
    .select("client_id, status")
    .in("client_id", clientIds)
    .not("assigned_to", "is", null);
  if (error) throw error;

  for (const clientId of clientIds) map.set(clientId, { totalAssigned: 0, completedAssigned: 0, allComplete: false });

  for (const row of data ?? []) {
    const entry = map.get(row.client_id);
    if (!entry) continue;
    entry.totalAssigned += 1;
    if (row.status === "fixed") entry.completedAssigned += 1;
  }
  for (const entry of map.values()) {
    entry.allComplete = entry.totalAssigned > 0 && entry.completedAssigned === entry.totalAssigned;
  }
  return map;
}

export async function moveClientToLegacy(supabase: SupabaseDb, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ stage: "legacy", stage_changed_at: new Date().toISOString() })
    .eq("id", clientId);
  if (error) throw error;
}

export async function extendSprintDeadline(
  supabase: SupabaseDb,
  clientId: string,
  newDeadline: string,
): Promise<void> {
  const { error } = await supabase.from("clients").update({ sprint_deadline: newDeadline }).eq("id", clientId);
  if (error) throw error;
}

/**
 * Persistent per-client "manual" audit row that hand-added sprint tasks
 * attach to (issues.audit_id is required) -- one row per client, reused
 * across every manually-added task rather than a new one each time.
 */
export async function getOrCreateManualAuditId(supabase: SupabaseDb, clientId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("audits")
    .select("id")
    .eq("client_id", clientId)
    .eq("source", "manual")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("audits")
    .insert({ client_id: clientId, source: "manual", status: "complete", run_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Failed to create manual audit row.");
  return created.id;
}

export interface AddSprintTaskInput {
  description: string;
  severity: IssueSeverity;
  assignedTo: string | null;
}

/** Adds a hand-entered sprint task as an issue (category sprint_task) -- shows up in Overview/Executables like any other issue. */
export async function addSprintTask(
  supabase: SupabaseDb,
  clientId: string,
  clientDomain: string,
  input: AddSprintTaskInput,
): Promise<void> {
  const auditId = await getOrCreateManualAuditId(supabase, clientId);
  const { error } = await supabase.from("issues").insert({
    audit_id: auditId,
    client_id: clientId,
    category: "sprint_task",
    severity: input.severity,
    url: clientDomain,
    description: input.description,
    assigned_to: input.assignedTo,
  });
  if (error) throw error;
}
