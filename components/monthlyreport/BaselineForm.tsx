"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Baseline } from "@/lib/monthlyReportTypes";

export function BaselineForm({ clientId, baseline }: { clientId: string; baseline: Baseline | null }) {
  const router = useRouter();
  const [impressions, setImpressions] = useState(baseline?.organicImpressions ?? 0);
  const [clicks, setClicks] = useState(baseline?.organicClicks ?? 0);
  const [indexedPages, setIndexedPages] = useState(baseline?.indexedPages ?? 0);
  const [backlinks, setBacklinks] = useState(baseline?.totalBacklinks ?? 0);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("baselines").upsert({
      client_id: clientId,
      organic_impressions: impressions,
      organic_clicks: clicks,
      indexed_pages: indexedPages,
      total_backlinks: backlinks,
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Organic impressions</label>
          <Input type="number" min={0} value={impressions} onChange={(e) => setImpressions(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Organic clicks</label>
          <Input type="number" min={0} value={clicks} onChange={(e) => setClicks(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Indexed pages</label>
          <Input type="number" min={0} value={indexedPages} onChange={(e) => setIndexedPages(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Total backlinks</label>
          <Input type="number" min={0} value={backlinks} onChange={(e) => setBacklinks(Number(e.target.value))} />
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save baseline"}
      </Button>
    </div>
  );
}
