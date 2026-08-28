"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AuditTriggerButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "starting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleClick() {
    setStatus("starting");
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start crawl.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={status === "starting"} size="sm">
        {status === "starting" ? "Starting crawl…" : "Run crawl now"}
      </Button>
      {status === "error" && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
