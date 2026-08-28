"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Report, ReportDelivery } from "@/lib/types";

export function ApproveSendBar({ report }: { report: Report }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setPending("approve");
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("reports")
      .update({ status: "approved", content: report.content })
      .eq("id", report.id);
    setPending(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function handleSend(via: ReportDelivery) {
    let recipientEmail: string | null = null;
    if (via === "gmail") {
      recipientEmail = window.prompt("Send to which email address?");
      if (!recipientEmail) return;
    }

    setPending("send");
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, sendVia: via, recipientEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send report.");
    } finally {
      setPending(null);
    }
  }

  if (report.status === "sent") {
    return (
      <p className="text-sm text-emerald-600">
        Sent via {report.sentVia} on {report.sentAt ? new Date(report.sentAt).toLocaleString() : ""}.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {report.status === "draft" && (
        <Button onClick={handleApprove} disabled={pending !== null} size="sm">
          {pending === "approve" ? "Approving…" : "Approve"}
        </Button>
      )}
      {report.status === "approved" && (
        <>
          <Button onClick={() => handleSend("gmail")} disabled={pending !== null} size="sm">
            {pending === "send" ? "Sending…" : "Send via Gmail"}
          </Button>
          <Button
            onClick={() => handleSend("drive")}
            disabled={pending !== null}
            size="sm"
            variant="secondary"
          >
            Save to Drive
          </Button>
        </>
      )}
      {report.status === "draft" && (
        <p className="text-xs text-muted-foreground">A report can&apos;t be sent while it&apos;s still a draft.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
