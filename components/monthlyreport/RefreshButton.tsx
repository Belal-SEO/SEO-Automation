"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/monthly-reports/${reportId}/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      if (body.errors?.gsc) {
        setErrorMessage(body.errors.gsc);
        setStatus("error");
      } else {
        setStatus("idle");
      }
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Refresh failed.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 print:hidden">
      <Button size="sm" variant="secondary" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? "Refreshing…" : "Refresh from GSC"}
      </Button>
      {status === "error" && <p className="max-w-xs text-right text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
