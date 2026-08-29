"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyReportTask, MonthlyTaskListKey } from "@/lib/monthlyReportTypes";

export function DetailList({
  reportId,
  listKey,
  tasks,
}: {
  reportId: string;
  listKey: MonthlyTaskListKey;
  tasks: MonthlyReportTask[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("monthly_report_tasks").insert({
      monthly_report_id: reportId,
      list_key: listKey,
      text: text.trim(),
      url: url.trim() || null,
      sort_index: tasks.length,
    });
    setText("");
    setUrl("");
    setBusy(false);
    router.refresh();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("monthly_report_tasks").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {task.text}
                {task.url && (
                  <a href={task.url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-muted-foreground hover:underline">
                    {task.url}
                  </a>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(task.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
                aria-label={`Remove: ${task.text}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Description"
          className="h-8 flex-1 min-w-[10rem] rounded-md border border-border bg-background px-2 text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (optional)"
          className="h-8 flex-1 min-w-[10rem] rounded-md border border-border bg-background px-2 text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || !text.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
