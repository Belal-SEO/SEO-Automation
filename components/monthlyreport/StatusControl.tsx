"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyReportStatus } from "@/lib/monthlyReportTypes";

const STATUS_OPTIONS: { value: MonthlyReportStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
];

export function StatusControl({ reportId, status }: { reportId: string; status: MonthlyReportStatus }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: MonthlyReportStatus) {
    setCurrent(next);
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("monthly_reports")
      .update({ status: next, sent_at: next === "sent" ? new Date().toISOString() : null })
      .eq("id", reportId);
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value as MonthlyReportStatus)}
      disabled={saving}
      className="h-8 rounded-md border border-border bg-background px-2 text-sm print:hidden"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
