import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Client, IssueCategory, IssueSeverity } from "@/lib/types";
import {
  fetchWpRemoteCoreStatus,
  fetchWpRemoteCronJobDetections,
  fetchWpRemoteDetectionSummary,
  fetchWpRemoteFileDetections,
  fetchWpRemoteMaliciousPlugins,
  fetchWpRemotePlugins,
  fetchWpRemoteRedirectionDetections,
  fetchWpRemoteScriptDetections,
  fetchWpRemoteThemes,
  type WpCvssRating,
  type WpRemoteSite,
  type WpRemoteVulnerability,
} from "@/lib/wpRemote";

type SupabaseDb = SupabaseClient<Database>;

function normalizeDomain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function matchByDomain(domain: string, sites: WpRemoteSite[]): WpRemoteSite | null {
  const target = normalizeDomain(domain);
  return sites.find((s) => normalizeDomain(s.url) === target || normalizeDomain(s.homeUrl) === target) ?? null;
}

/**
 * Resolves a client to its WP Remote site. Tries, in order: the manual
 * override as a literal site ID, the override as a URL/domain (since the
 * override field isn't guaranteed to hold WP Remote's opaque internal ID --
 * that's not visible anywhere in WP Remote's own dashboard, so people
 * reasonably paste a site name or URL there instead), then the client's own
 * domain. A garbage override never permanently blocks matching.
 */
export function resolveWpRemoteSite(
  client: Pick<Client, "domain" | "wpRemoteSiteId">,
  sites: WpRemoteSite[],
): WpRemoteSite | null {
  if (client.wpRemoteSiteId) {
    const byId = sites.find((s) => s.id === client.wpRemoteSiteId);
    if (byId) return byId;
    const byOverrideAsDomain = matchByDomain(client.wpRemoteSiteId, sites);
    if (byOverrideAsDomain) return byOverrideAsDomain;
  }
  return matchByDomain(client.domain, sites);
}

function severityFromCvss(rating: WpCvssRating | null): IssueSeverity {
  if (rating === "critical") return "critical";
  if (rating === "high") return "high";
  if (rating === "medium") return "medium";
  return "low";
}

interface Finding {
  externalId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  description: string;
}

async function getOrCreateWpRemoteAuditId(supabase: SupabaseDb, clientId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("audits")
    .select("id")
    .eq("client_id", clientId)
    .eq("source", "wp_remote")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("audits")
      .update({ run_at: new Date().toISOString(), status: "complete", error: null })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("audits")
    .insert({ client_id: clientId, source: "wp_remote", status: "complete", run_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Failed to create WP Remote audit row.");
  return created.id;
}

function vulnerabilityFinding(
  siteId: string,
  component: "core" | "plugin" | "theme",
  slug: string,
  componentLabel: string,
  currentVersion: string | null,
  vuln: WpRemoteVulnerability,
): Finding {
  const cve = vuln.cveId ? ` (${vuln.cveId})` : "";
  const patch = vuln.patchedVersion ? ` — patch to ${vuln.patchedVersion}` : "";
  return {
    externalId: `${siteId}:vuln:${component}:${slug}:${vuln.vulnerabilityId}`,
    category: "vulnerability",
    severity: severityFromCvss(vuln.cvssRating),
    description: `${vuln.title}${cve} in ${componentLabel}${currentVersion ? ` v${currentVersion}` : ""}${patch}`,
  };
}

function outdatedFinding(
  siteId: string,
  component: "core" | "plugin" | "theme",
  slug: string,
  componentLabel: string,
  currentVersion: string | null,
  latestVersion: string | null,
): Finding {
  return {
    externalId: `${siteId}:update:${component}:${slug}`,
    category: "outdated_software",
    severity: component === "core" ? "medium" : "low",
    description: `${componentLabel} update available: ${currentVersion ?? "?"} → ${latestVersion ?? "?"}`,
  };
}

function locationSummary(location: Record<string, unknown>): string {
  if (location.type === "database") return `database table ${String(location.table_name ?? "?")}`;
  if (typeof location.url === "string") return location.url;
  return String(location.type ?? "unknown location");
}

/** Pulls every current finding for one WP Remote site: outdated/vulnerable core+plugins+themes, plus unresolved malware detections. */
async function collectFindings(site: WpRemoteSite): Promise<Finding[]> {
  const findings: Finding[] = [];

  const [core, plugins, themes] = await Promise.all([
    fetchWpRemoteCoreStatus([site.id]),
    fetchWpRemotePlugins([site.id]),
    fetchWpRemoteThemes([site.id]),
  ]);

  const coreStatus = core.get(site.id);
  if (coreStatus) {
    if (coreStatus.vulnerabilities.length > 0) {
      for (const v of coreStatus.vulnerabilities) {
        findings.push(vulnerabilityFinding(site.id, "core", "core", "WordPress core", coreStatus.currentVersion, v));
      }
    } else if (coreStatus.updateAvailable) {
      findings.push(
        outdatedFinding(site.id, "core", "core", "WordPress core", coreStatus.currentVersion, coreStatus.latestVersion),
      );
    }
  }

  for (const p of plugins.get(site.id) ?? []) {
    if (p.vulnerabilities.length > 0) {
      for (const v of p.vulnerabilities) {
        findings.push(vulnerabilityFinding(site.id, "plugin", p.slug, `plugin "${p.name}"`, p.currentVersion, v));
      }
    } else if (p.updateAvailable) {
      findings.push(outdatedFinding(site.id, "plugin", p.slug, `Plugin "${p.name}"`, p.currentVersion, p.latestVersion));
    }
  }

  for (const t of themes.get(site.id) ?? []) {
    if (t.vulnerabilities.length > 0) {
      for (const v of t.vulnerabilities) {
        findings.push(vulnerabilityFinding(site.id, "theme", t.slug, `theme "${t.name}"`, t.currentVersion, v));
      }
    } else if (t.updateAvailable) {
      findings.push(outdatedFinding(site.id, "theme", t.slug, `Theme "${t.name}"`, t.currentVersion, t.latestVersion));
    }
  }

  // Only pull each detection detail list when the summary says it has
  // unresolved (not-marked-safe) entries, to keep API calls to a minimum.
  const summary = await fetchWpRemoteDetectionSummary(site.id);

  if (summary.files > 0) {
    for (const f of (await fetchWpRemoteFileDetections(site.id)).filter((f) => !f.markedSafe)) {
      findings.push({
        externalId: `${site.id}:malware:file:${f.id}`,
        category: "malware",
        severity: "critical",
        description: `Malicious file detected: ${f.path}`,
      });
    }
  }

  if (summary.scripts > 0) {
    for (const s of (await fetchWpRemoteScriptDetections(site.id)).filter((s) => !s.markedSafe)) {
      findings.push({
        externalId: `${site.id}:malware:script:${s.id}`,
        category: "malware",
        severity: "critical",
        description: `Malicious script detected (${s.threatTypes.join(", ") || "unknown"}) — ${locationSummary(s.location)}`,
      });
    }
  }

  if (summary.plugins > 0) {
    for (const p of await fetchWpRemoteMaliciousPlugins(site.id)) {
      findings.push({
        externalId: `${site.id}:malware:plugin:${p.slug}`,
        category: "malware",
        severity: "critical",
        description: `Plugin "${p.name}" flagged as malicious${p.currentVersion ? ` (v${p.currentVersion})` : ""}`,
      });
    }
  }

  if (summary.cronJobs > 0) {
    for (const c of (await fetchWpRemoteCronJobDetections(site.id)).filter((c) => !c.markedSafe)) {
      findings.push({
        externalId: `${site.id}:malware:cron:${c.id}`,
        category: "malware",
        severity: "critical",
        description: `Malicious cron job: ${c.content}`,
      });
    }
  }

  if (summary.redirections > 0) {
    for (const r of (await fetchWpRemoteRedirectionDetections(site.id)).filter((r) => !r.markedSafe)) {
      findings.push({
        externalId: `${site.id}:malware:redirect:${r.from}->${r.to}`,
        category: "malware",
        severity: "critical",
        description: `Malicious redirect (${r.type}): ${r.from} → ${r.to}`,
      });
    }
  }

  return findings;
}

export interface WpRemoteSyncResult {
  matched: boolean;
  siteId: string | null;
  siteUrl: string | null;
  findingCount: number;
  newCount: number;
  resolvedCount: number;
}

/**
 * Syncs one client's WP Remote security findings into `issues`, given the
 * already-fetched site list (fetch once, reuse across every client). Inserts
 * new findings, refreshes severity/description on ones still present, and
 * auto-resolves (status -> fixed) previously-synced findings no longer
 * reported -- never touches an issue's status in the other direction, so a
 * manual "in progress"/"fixed" call is never silently overwritten.
 */
export async function syncClientSecurity(
  supabase: SupabaseDb,
  client: Client,
  sites: WpRemoteSite[],
): Promise<WpRemoteSyncResult> {
  const site = resolveWpRemoteSite(client, sites);
  if (!site) return { matched: false, siteId: null, siteUrl: null, findingCount: 0, newCount: 0, resolvedCount: 0 };

  if (client.wpRemoteSiteId !== site.id) {
    await supabase.from("clients").update({ wp_remote_site_id: site.id }).eq("id", client.id);
  }

  const findings = await collectFindings(site);
  const auditId = await getOrCreateWpRemoteAuditId(supabase, client.id);

  const { data: existingRows } = await supabase
    .from("issues")
    .select("id, external_id, status")
    .eq("client_id", client.id)
    .not("external_id", "is", null);
  const existingByExternalId = new Map((existingRows ?? []).map((r) => [r.external_id as string, r]));

  let newCount = 0;
  for (const finding of findings) {
    const existing = existingByExternalId.get(finding.externalId);
    if (existing) {
      await supabase
        .from("issues")
        .update({ severity: finding.severity, description: finding.description })
        .eq("id", existing.id);
    } else {
      await supabase.from("issues").insert({
        audit_id: auditId,
        client_id: client.id,
        category: finding.category,
        severity: finding.severity,
        url: client.domain,
        description: finding.description,
        external_id: finding.externalId,
      });
      newCount++;
    }
  }

  const currentExternalIds = new Set(findings.map((f) => f.externalId));
  const staleIds = (existingRows ?? [])
    .filter((r) => r.external_id && !currentExternalIds.has(r.external_id) && r.status !== "fixed")
    .map((r) => r.id);

  let resolvedCount = 0;
  if (staleIds.length > 0) {
    await supabase.from("issues").update({ status: "fixed", fixed_at: new Date().toISOString() }).in("id", staleIds);
    await supabase.from("issue_activity").insert(
      staleIds.map((issueId) => ({
        issue_id: issueId,
        client_id: client.id,
        activity_type: "status_change" as const,
        new_status: "fixed" as const,
        note: "Auto-resolved: no longer detected by WP Remote.",
      })),
    );
    resolvedCount = staleIds.length;
  }

  return { matched: true, siteId: site.id, siteUrl: site.url, findingCount: findings.length, newCount, resolvedCount };
}
