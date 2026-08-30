"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyReportTask, MonthlyTaskListKey } from "@/lib/monthlyReportTypes";

const PLACEHOLDERS: Record<MonthlyTaskListKey, string> = {
  issues: "Enter issue…",
  pages_optimised: "Enter URL…",
  new_pages: "Enter URL…",
  backlinks: "Enter link…",
  blog_posts: "Title / URL…",
  cro: "Describe change…",
  notes: "Add a note, update, or paste a link…",
};

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function DetailItem({
  task,
  accent,
  placeholder,
  onRemove,
}: {
  task: MonthlyReportTask;
  accent: string;
  placeholder: string;
  onRemove: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(task.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) autoGrow(ref.current);
  }, []);

  async function handleBlur() {
    if (text === task.text) return;
    const supabase = createClient();
    await supabase.from("monthly_report_tasks").update({ text }).eq("id", task.id);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ flex: "none", width: 5, height: 5, borderRadius: "50%", background: accent, marginTop: 9 }} />
      <textarea
        ref={ref}
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          autoGrow(e.target);
        }}
        onBlur={handleBlur}
        style={{
          flex: 1,
          font: "400 12.5px/1.5 var(--font-dm-sans)",
          color: "#333",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: 5,
          padding: "2px 6px",
          outline: "none",
          resize: "none",
          overflow: "hidden",
          minHeight: 22,
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        className="print:hidden"
        aria-label="Remove"
        style={{
          flex: "none",
          width: 20,
          height: 20,
          marginTop: 3,
          background: "none",
          border: "1px solid rgba(0,0,0,.12)",
          borderRadius: 5,
          color: "#bbb",
          font: "400 13px/1 var(--font-dm-sans)",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

export function DetailList({
  reportId,
  listKey,
  tasks,
  accent,
}: {
  reportId: string;
  listKey: MonthlyTaskListKey;
  tasks: MonthlyReportTask[];
  accent: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("monthly_report_tasks").insert({
      monthly_report_id: reportId,
      list_key: listKey,
      text: "",
      sort_index: tasks.length,
    });
    setBusy(false);
    router.refresh();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("monthly_report_tasks").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {tasks.map((task) => (
        <DetailItem
          key={task.id}
          task={task}
          accent={accent}
          placeholder={PLACEHOLDERS[listKey]}
          onRemove={() => handleRemove(task.id)}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        disabled={busy}
        className="print:hidden"
        style={{
          width: "100%",
          marginTop: 2,
          background: "none",
          border: "1px dashed rgba(0,0,0,.16)",
          borderRadius: 6,
          padding: 6,
          font: "600 11px/1 var(--font-dm-sans)",
          color: "#999",
          cursor: "pointer",
        }}
      >
        + Add
      </button>
    </div>
  );
}
