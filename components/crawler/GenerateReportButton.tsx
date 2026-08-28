"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateReportButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleClick() {
    setStatus("generating");
    setErrorMessage("");
    try {
      const res = await fetch("/api/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      router.push(`/clients/${clientId}/reports/${body.reportId}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate report draft.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={status === "generating"} size="sm" variant="secondary">
        {status === "generating" ? "Drafting…" : "Generate report draft"}
      </Button>
      {status === "error" && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
