"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyReportSettings } from "@/lib/monthlyReportTypes";

export function MonthlyReportSettingsForm({
  clientId,
  settings,
}: {
  clientId: string;
  settings: MonthlyReportSettings | null;
}) {
  const router = useRouter();
  const [agencyLabel, setAgencyLabel] = useState(settings?.agencyLabel ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(settings?.websiteUrl ?? "");
  const [clientEmail, setClientEmail] = useState(settings?.clientEmail ?? "");
  const [gscSiteUrl, setGscSiteUrl] = useState(settings?.gscSiteUrl ?? "");
  const [backlinksSheetId, setBacklinksSheetId] = useState(settings?.backlinksSheetId ?? "");
  const [backlinksSheetTab, setBacklinksSheetTab] = useState(settings?.backlinksSheetTab ?? "");
  const [gbpLocationId, setGbpLocationId] = useState(settings?.gbpLocationId ?? "");
  const [sendDayOfMonth, setSendDayOfMonth] = useState(settings?.sendDayOfMonth ?? 5);
  const [reviewLeadDays, setReviewLeadDays] = useState(settings?.reviewLeadDays ?? 3);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("monthly_report_settings").upsert({
      client_id: clientId,
      agency_label: agencyLabel.trim() || null,
      website_url: websiteUrl.trim() || null,
      client_email: clientEmail.trim() || null,
      gsc_site_url: gscSiteUrl.trim() || null,
      backlinks_sheet_id: backlinksSheetId.trim() || null,
      backlinks_sheet_tab: backlinksSheetTab.trim() || null,
      gbp_location_id: gbpLocationId.trim() || null,
      send_day_of_month: sendDayOfMonth,
      review_lead_days: reviewLeadDays,
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Agency label</label>
          <Input
            value={agencyLabel}
            onChange={(e) => setAgencyLabel(e.target.value)}
            placeholder="PatientClicks · Local SEO Campaign"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Website URL</label>
          <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Client email</label>
          <Input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="owner@clinic.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            GSC site URL <span className="text-muted-foreground">(optional — enables live pull)</span>
          </label>
          <Input
            value={gscSiteUrl}
            onChange={(e) => setGscSiteUrl(e.target.value)}
            placeholder="sc-domain:example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Backlinks Sheet ID <span className="text-muted-foreground">(optional)</span>
          </label>
          <Input
            value={backlinksSheetId}
            onChange={(e) => setBacklinksSheetId(e.target.value)}
            placeholder="1Ax...the long ID in the Sheet's URL"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Backlinks Sheet tab name</label>
          <Input
            value={backlinksSheetTab}
            onChange={(e) => setBacklinksSheetTab(e.target.value)}
            placeholder="Backlinks"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            GBP location ID <span className="text-muted-foreground">(optional — needs Google&apos;s GBP API approval)</span>
          </label>
          <Input
            value={gbpLocationId}
            onChange={(e) => setGbpLocationId(e.target.value)}
            placeholder="accounts/123/locations/456"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Send day of month</label>
          <Input
            type="number"
            min={1}
            max={28}
            value={sendDayOfMonth}
            onChange={(e) => setSendDayOfMonth(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Review lead days</label>
          <Input
            type="number"
            min={1}
            value={reviewLeadDays}
            onChange={(e) => setReviewLeadDays(Number(e.target.value))}
          />
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
