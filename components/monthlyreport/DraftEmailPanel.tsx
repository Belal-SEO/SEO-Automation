"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyReportEmailDraft } from "@/lib/monthlyReportTypes";

export function DraftEmailPanel({ reportId, draft }: { reportId: string; draft: MonthlyReportEmailDraft | null }) {
  const router = useRouter();
  const [toEmail, setToEmail] = useState(draft?.toEmail ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/monthly-reports/${reportId}/email-draft`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setToEmail(body.draft.to_email ?? "");
      setSubject(body.draft.subject);
      setBody(body.draft.body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveField(patch: Record<string, string | null>) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("monthly_report_email_drafts").upsert({
      monthly_report_id: reportId,
      to_email: toEmail || null,
      subject,
      body,
      ...patch,
    });
    setSaving(false);
    router.refresh();
  }

  async function handleApprove() {
    await handleSaveField({ status: "approved" });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={generating}>
          {generating ? "Drafting…" : draft ? "Regenerate draft" : "Generate draft"}
        </Button>
        {draft?.status === "approved" && (
          <span className="text-xs font-medium text-emerald-600">Approved</span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {(draft || subject || body) && (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              onBlur={() => handleSaveField({})}
              placeholder="client@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => handleSaveField({})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Body</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => handleSaveField({})}
              rows={10}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApprove} disabled={saving || draft?.status === "approved"}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
