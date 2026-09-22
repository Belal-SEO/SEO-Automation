"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeSprintDeadline } from "@/lib/clientStage";
import type { ClientStage, CmsType } from "@/lib/types";

const CMS_OPTIONS: { value: CmsType; label: string }[] = [
  { value: null, label: "Unknown" },
  { value: "wordpress", label: "WordPress" },
  { value: "custom", label: "Custom / fragile theme" },
  { value: "shopify", label: "Shopify" },
  { value: "wix", label: "Wix" },
  { value: "squarespace", label: "Squarespace" },
];

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ClientForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [locations, setLocations] = useState("");
  const [domain, setDomain] = useState("");
  const [cmsType, setCmsType] = useState<CmsType>(null);
  const [stage, setStage] = useState<ClientStage>("new");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidUrl(domain)) {
      setDomainError("Enter a full URL, e.g. https://example.com");
      return;
    }
    setDomainError(null);

    const supabase = createClient();

    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .ilike("domain", domain)
      .maybeSingle();

    if (existing && !duplicateWarning) {
      setDuplicateWarning("A client with this domain already exists. Submit again to save anyway.");
      return;
    }

    setSubmitting(true);
    const { data: created, error: insertError } = await supabase
      .from("clients")
      .insert({
        name,
        brand,
        locations: locations
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        domain,
        cms_type: cmsType,
        stage,
        sprint_started_at: stage === "new" ? new Date().toISOString() : null,
        sprint_deadline: stage === "new" ? computeSprintDeadline() : null,
      })
      .select("id")
      .single();
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Best-effort: the site may not be added in WP Remote yet, or the
    // domain may not auto-match -- either way, this shouldn't block or
    // fail client creation. The client page's "Sync now" button covers it.
    if (created) {
      fetch(`/api/clients/${created.id}/wp-remote-sync`, { method: "POST" }).catch(() => {});
    }

    setDuplicateWarning(null);
    router.refresh();
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Clinic name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Brand (source of truth)</label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Locations (comma-separated)</label>
        <Input value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Austin, TX; Round Rock, TX" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Domain</label>
        <Input
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setDuplicateWarning(null);
          }}
          placeholder="https://example.com"
          required
        />
        {domainError && <p className="text-xs text-destructive">{domainError}</p>}
        {duplicateWarning && <p className="text-xs text-amber-600">{duplicateWarning}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">CMS</label>
        <select
          value={cmsType ?? ""}
          onChange={(e) => setCmsType((e.target.value || null) as CmsType)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {CMS_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value ?? ""}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Client type</label>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as ClientStage)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="new">New — 90-day sprint (manual tasks + Monthly Reports)</option>
          <option value="legacy">Legacy — ongoing (crawl audits)</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : duplicateWarning ? "Save anyway" : "Add client"}
      </Button>
    </form>
  );
}
