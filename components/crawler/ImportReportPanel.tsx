"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { addManualIssues, type AddManualIssueInput } from "@/lib/clientStage";
import { ISSUE_CATEGORY_LABELS, type IssueCategory, type IssueSeverity } from "@/lib/types";

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const LEGACY_CATEGORY_OPTIONS = (Object.entries(ISSUE_CATEGORY_LABELS) as [IssueCategory, string][]).filter(
  ([value]) => value !== "sprint_task",
);

interface DraftTask {
  selected: boolean;
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
  assignedTo: string;
}

interface ExtractedTaskResponse {
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
}

export function ImportReportPanel({
  clientId,
  clientDomain,
  isNew,
}: {
  clientId: string;
  clientDomain: string;
  isNew: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftTask[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    setResultMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/clients/${clientId}/import-report`, { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      const tasks: ExtractedTaskResponse[] = body.tasks ?? [];
      setDrafts(
        tasks.map((t) => ({
          selected: true,
          description: t.description,
          severity: t.severity,
          category: t.category,
          assignedTo: "",
        })),
      );
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  function updateDraft(index: number, patch: Partial<DraftTask>) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? { ...d, ...patch } : d)) : prev));
  }

  async function handleCreate() {
    if (!drafts) return;
    const selected = drafts.filter((d) => d.selected && d.description.trim());
    if (selected.length === 0) return;
    setCreating(true);
    const supabase = createClient();
    const inputs: AddManualIssueInput[] = selected.map((d) => ({
      description: d.description.trim(),
      severity: d.severity,
      category: d.category,
      assignedTo: d.assignedTo.trim() || null,
    }));
    await addManualIssues(supabase, clientId, clientDomain, inputs);
    setCreating(false);
    setResultMessage(`Added ${selected.length} task${selected.length === 1 ? "" : "s"}.`);
    setDrafts(null);
    setFile(null);
    router.refresh();
  }

  const selectedCount = drafts?.filter((d) => d.selected).length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Upload a PDF or HTML audit report — an AI model reads it and pulls out the actionable tasks below for you
        to review before anything is added to {isNew ? "Sprint Tasks" : "Issues"}.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pdf,.html,.htm,application/pdf,text/html"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button size="sm" onClick={handleExtract} disabled={!file || extracting}>
          {extracting ? "Reading report…" : "Extract tasks"}
        </Button>
      </div>
      {extractError && <p className="text-sm text-destructive">{extractError}</p>}
      {resultMessage && <p className="text-sm text-emerald-600">{resultMessage}</p>}

      {drafts && drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {drafts.length} task{drafts.length === 1 ? "" : "s"} found — review before adding.
            </p>
            <Button size="sm" onClick={handleCreate} disabled={creating || selectedCount === 0}>
              {creating ? "Adding…" : `Add ${selectedCount} task${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </div>
          <div className="space-y-2">
            {drafts.map((draft, i) => (
              <div key={i} className="flex flex-wrap items-start gap-2 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  checked={draft.selected}
                  onChange={(e) => updateDraft(i, { selected: e.target.checked })}
                  className="mt-2 h-4 w-4"
                  aria-label={`Include: ${draft.description}`}
                />
                <textarea
                  value={draft.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                  rows={2}
                  className="min-w-[16rem] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <select
                  value={draft.severity}
                  onChange={(e) => updateDraft(i, { severity: e.target.value as IssueSeverity })}
                  aria-label="Priority"
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!isNew && (
                  <select
                    value={draft.category}
                    onChange={(e) => updateDraft(i, { category: e.target.value as IssueCategory })}
                    aria-label="Category"
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {LEGACY_CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  value={draft.assignedTo}
                  onChange={(e) => updateDraft(i, { assignedTo: e.target.value })}
                  placeholder="Assign to (optional)"
                  className="h-8 w-40 rounded-md border border-border bg-background px-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
