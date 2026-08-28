"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

export function NotificationSettings({ client }: { client: Client }) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(client.criticalAlertThreshold);
  const [cadence, setCadence] = useState(client.reportCadenceDays);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("clients")
      .update({ critical_alert_threshold: threshold, report_cadence_days: cadence })
      .eq("id", client.id);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Alert after this many new critical issues
          </label>
          <Input
            type="number"
            min={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Report cadence (days)</label>
          <Input
            type="number"
            min={7}
            value={cadence}
            onChange={(e) => setCadence(Number(e.target.value))}
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
