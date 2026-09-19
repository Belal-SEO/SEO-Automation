"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Audit, Client } from "@/lib/types";

export function WpRemoteSecurityPanel({ client, lastSync }: { client: Client; lastSync: Audit | null }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(client.wpRemoteSiteId ?? "");
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSaveSiteId() {
    if (siteId === (client.wpRemoteSiteId ?? "")) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("clients").update({ wp_remote_site_id: siteId.trim() || null }).eq("id", client.id);
    setSaving(false);
    router.refresh();
  }

  async function handleSync() {
    setSyncStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/clients/${client.id}/wp-remote-sync`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setSyncStatus("idle");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sync failed.");
      setSyncStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pulls malware detections, known vulnerabilities, and outdated core/plugin/theme status from WP
        Remote into the issue list above — matched to this client by domain, or by the site ID below.
      </p>

      <p className="text-sm text-muted-foreground">
        {lastSync ? (
          <>
            Last synced {formatDate(lastSync.runAt)}
            {lastSync.status === "failed" && lastSync.error ? (
              <span className="text-destructive"> — {lastSync.error}</span>
            ) : null}
          </>
        ) : (
          "Never synced."
        )}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            WP Remote site ID{" "}
            <span className="text-muted-foreground">(optional — only needed if the domain doesn&apos;t auto-match)</span>
          </label>
          <Input
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            onBlur={handleSaveSiteId}
            disabled={saving}
            placeholder="Auto-matched by domain"
            className="w-72"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={handleSync} disabled={syncStatus === "loading"}>
          {syncStatus === "loading" ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      {syncStatus === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
