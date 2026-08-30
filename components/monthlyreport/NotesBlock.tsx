"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyReportTask } from "@/lib/monthlyReportTypes";

const URL_RE = /https?:\/\/[^\s]+/;

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function NoteItem({ task, accent, onRemove }: { task: MonthlyReportTask; accent: string; onRemove: () => void }) {
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

  const urlMatch = text.match(URL_RE);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ flex: "none", width: 5, height: 5, borderRadius: "50%", background: accent, marginTop: 9 }} />
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder="Add a note, update, or paste a link…"
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
      {urlMatch && (
        <a
          href={urlMatch[0]}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            marginLeft: 19,
            font: "500 12px/1.4 var(--font-dm-sans)",
            color: "#005f56",
            wordBreak: "break-all",
          }}
        >
          {urlMatch[0]}
        </a>
      )}
    </div>
  );
}

export function NotesBlock({
  reportId,
  tasks,
  accent,
  accentBg,
}: {
  reportId: string;
  tasks: MonthlyReportTask[];
  accent: string;
  accentBg: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("monthly_report_tasks").insert({
      monthly_report_id: reportId,
      list_key: "notes",
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
    <div
      className="notes-block avoid-break"
      data-empty={tasks.length === 0 ? "1" : "0"}
      style={{ marginTop: 18, background: accentBg, borderRadius: 10, padding: "15px 18px" }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--font-dm-sans)",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 11,
        }}
      >
        Special Notes
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {tasks.map((task) => (
          <NoteItem key={task.id} task={task} accent={accent} onRemove={() => handleRemove(task.id)} />
        ))}
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={busy}
        className="print:hidden"
        style={{
          marginTop: 10,
          background: "#fff",
          border: "1px dashed rgba(0,0,0,.18)",
          borderRadius: 6,
          padding: "6px 12px",
          font: "600 11px/1 var(--font-dm-sans)",
          color: accent,
          cursor: "pointer",
        }}
      >
        + Add note
      </button>
    </div>
  );
}
