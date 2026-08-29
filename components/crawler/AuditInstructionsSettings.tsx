"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

export function AuditInstructionsSettings({ client }: { client: Client }) {
  const router = useRouter();
  const [instructions, setInstructions] = useState(client.customAuditInstructions ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("clients")
      .update({ custom_audit_instructions: instructions.trim() || null })
      .eq("id", client.id);
    setSaving(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Added to the crawl&apos;s audit prompt for this client only — e.g. specific service or location
        pages to check, competitor NAP details to compare against, or brand-voice notes. Leave blank
        to just use the default local SEO audit checklist.
      </p>
      <Textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={6}
        placeholder={"e.g. Pay extra attention to the /locations/* pages — check that each has a unique address, phone number, and embedded map, and flag any that look like duplicates of each other."}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save instructions"}
        </Button>
        {savedAt && !saving && (
          <span className="text-xs text-muted-foreground">Saved {savedAt.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
