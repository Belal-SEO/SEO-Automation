"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Baseline } from "@/lib/monthlyReportTypes";

function defaultDateRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3); // GSC data typically lags 2-3 days
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function BaselineSummaryCard({
  clientId,
  gscSiteUrl,
  baseline,
}: {
  clientId: string;
  gscSiteUrl: string | null;
  baseline: Baseline | null;
}) {
  const router = useRouter();
  const defaults = defaultDateRange();
  const [siteUrl, setSiteUrl] = useState(gscSiteUrl ?? "");
  const [startDate, setStartDate] = useState(baseline?.capturedRangeStart ?? defaults.start);
  const [endDate, setEndDate] = useState(baseline?.capturedRangeEnd ?? defaults.end);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportForm, setShowImportForm] = useState(!baseline);

  const [indexedPages, setIndexedPages] = useState(baseline?.indexedPages ?? 0);
  const [generativeAppearances, setGenerativeAppearances] = useState(baseline?.generativeEngineAppearances ?? 0);
  const [savingManual, setSavingManual] = useState(false);

  async function handleImport() {
    if (!siteUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/baseline/import-gsc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: siteUrl.trim(), startDate, endDate }),
      });
      const rawText = await res.text();
      let body: { error?: string } = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        // Not JSON -- likely a platform-level error page.
      }
      if (!res.ok) {
        throw new Error(body.error ?? `Import failed (${res.status}): ${rawText.slice(0, 300) || "no response body"}`);
      }
      setShowImportForm(false);
      router.refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function handleSaveManual() {
    setSavingManual(true);
    const supabase = createClient();
    await supabase.from("baselines").upsert(
      {
        client_id: clientId,
        indexed_pages: indexedPages,
        generative_engine_appearances: generativeAppearances,
      },
      { onConflict: "client_id" },
    );
    setSavingManual(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Baseline</CardTitle>
        <CardDescription>
          Where this client started, imported from Search Console — indexed pages and generative-engine (AI
          Overviews) appearances stay manual since Google only shows those in its own dashboard, not via any API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showImportForm && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">GSC property URL</label>
                <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com/" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={handleImport} disabled={importing || !siteUrl.trim()}>
              {importing ? "Importing…" : baseline ? "Re-import from Search Console" : "Import baseline from Search Console"}
            </Button>
            {importError && <p className="text-sm text-destructive">{importError}</p>}
          </div>
        )}

        {baseline && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Impressions" value={baseline.organicImpressions.toLocaleString()} />
              <Stat label="Clicks" value={baseline.organicClicks.toLocaleString()} />
              <Stat
                label="Sitemap"
                value={
                  baseline.sitemapSubmitted == null ? "—" : baseline.sitemapSubmitted ? "Submitted" : "Not submitted"
                }
              />
              <Stat label="Pages in sitemap" value={baseline.sitemapPageCount?.toLocaleString() ?? "—"} />
            </div>

            {baseline.capturedRangeStart && baseline.capturedRangeEnd && (
              <p className="text-xs text-muted-foreground">
                Captured {formatDate(baseline.capturedRangeStart)} – {formatDate(baseline.capturedRangeEnd)}
              </p>
            )}

            {baseline.topPages.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Top pages
                </h3>
                <ul className="space-y-1 text-sm">
                  {baseline.topPages.map((p) => (
                    <li key={p.url} className="flex items-center justify-between gap-3">
                      <span className="truncate" title={p.url}>
                        {p.url}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.clicks.toLocaleString()} clicks · {p.impressions.toLocaleString()} impr.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Indexed pages (manual)</label>
                <Input
                  type="number"
                  min={0}
                  value={indexedPages}
                  onChange={(e) => setIndexedPages(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Generative engine appearances (manual)</label>
                <Input
                  type="number"
                  min={0}
                  value={generativeAppearances}
                  onChange={(e) => setGenerativeAppearances(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" variant="secondary" onClick={handleSaveManual} disabled={savingManual}>
                  {savingManual ? "Saving…" : "Save"}
                </Button>
                {!showImportForm && (
                  <Button size="sm" variant="ghost" onClick={() => setShowImportForm(true)}>
                    Re-import
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
