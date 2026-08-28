"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/input";
import { ApproveSendBar } from "@/components/crawler/ApproveSendBar";
import { createClient } from "@/lib/supabase/client";
import type { Report } from "@/lib/types";

export function ReportDraftEditor({ report }: { report: Report }) {
  const router = useRouter();
  const [content, setContent] = useState(report.content);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function handleBlurSave() {
    if (content === report.content || report.status !== "draft") return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("reports").update({ content }).eq("id", report.id);
    setSaving(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlurSave}
          disabled={report.status !== "draft"}
          rows={20}
          className="font-mono text-sm leading-relaxed"
          aria-label="Report draft content (Markdown)"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {report.status !== "draft"
            ? "This report has been approved and is read-only."
            : saving
              ? "Saving…"
              : savedAt
                ? `Saved ${savedAt.toLocaleTimeString()}`
                : "Edits save automatically when you click away."}
        </p>
      </div>

      <ApproveSendBar report={{ ...report, content }} />
    </div>
  );
}
