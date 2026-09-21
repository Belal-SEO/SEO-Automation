// Thin client for the WP Remote (BlogVault) API v6 -- https://docs.blogvault.net/api/v6/
// Server-only: never import this from a "use client" component, the API key
// must stay off the browser.

const BASE_URL = "https://api.blogvault.net/api/v6";

function apiKey(): string {
  const key = process.env.WP_REMOTE_API_KEY;
  if (!key) throw new Error("WP_REMOTE_API_KEY is not configured.");
  return key;
}

async function wpRemoteRequest<T>(
  path: string,
  searchParams?: Record<string, string | number | boolean | string[] | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    const body = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    const detail = body?.error?.message ?? raw;
    const code = body?.error?.code ? ` [${body.error.code}]` : "";
    throw new Error(`WP Remote ${path}${code} (${res.status}): ${detail || "no error body"} -- query: ${url.search}`);
  }

  return res.json() as Promise<T>;
}

interface Paginated<T, K extends string> {
  meta: { pagination: { page: number; perPage: number; totalPages: number; totalItems: number } };
}

/** Follows `meta.pagination` until every page of `itemsKey` has been collected. */
async function wpRemotePaginate<T, K extends string>(
  path: string,
  itemsKey: K,
  searchParams?: Record<string, string | number | boolean | string[] | undefined>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  // Safety cap so a misbehaving account/response can't loop forever.
  for (let i = 0; i < 200; i++) {
    const data = await wpRemoteRequest<Record<K, T[]> & Paginated<T, K>>(path, {
      ...searchParams,
      page,
      perPage: 100,
    });
    items.push(...(data[itemsKey] ?? []));
    if (page >= data.meta.pagination.totalPages) break;
    page++;
  }
  return items;
}

export interface WpRemoteSite {
  id: string;
  url: string;
  homeUrl: string;
  companyName: string | null;
  securityEnabled: boolean;
  scannerStatus: "clean" | "hacked";
}

interface RawSite {
  id: string;
  url: string;
  home_url: string;
  client: { company_name: string } | null;
  security: { enabled: boolean; scanner: { status: "clean" | "hacked" } };
}

export async function fetchWpRemoteSites(): Promise<WpRemoteSite[]> {
  const raw = await wpRemotePaginate<RawSite, "sites">("/sites", "sites");
  return raw.map((s) => ({
    id: s.id,
    url: s.url,
    homeUrl: s.home_url,
    companyName: s.client?.company_name ?? null,
    securityEnabled: s.security.enabled,
    scannerStatus: s.security.scanner.status,
  }));
}

export type WpCvssRating = "none" | "low" | "medium" | "high" | "critical";

export interface WpRemoteVulnerability {
  vulnerabilityId: string;
  title: string;
  cveId: string | null;
  cvssRating: WpCvssRating | null;
  patchedVersion: string | null;
}

interface RawVulnerability {
  vulnerability_id: string;
  title: string;
  cve_id: string | null;
  cvss_rating: WpCvssRating | null;
  patched_version: string | null;
}

function mapVulnerabilities(security?: { vulnerabilities?: RawVulnerability[] }): WpRemoteVulnerability[] {
  return (security?.vulnerabilities ?? []).map((v) => ({
    vulnerabilityId: v.vulnerability_id,
    title: v.title,
    cveId: v.cve_id,
    cvssRating: v.cvss_rating,
    patchedVersion: v.patched_version,
  }));
}

export interface WpRemoteCoreStatus {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  vulnerabilities: WpRemoteVulnerability[];
}

interface RawCoreSite {
  id: string;
  wp: {
    core: {
      current_version: string | null;
      latest_version: string | null;
      update_available: boolean;
      security?: { vulnerabilities?: RawVulnerability[] };
    };
  };
}

/** Core update/vulnerability status for the given sites, keyed by site id. */
export async function fetchWpRemoteCoreStatus(siteIds: string[]): Promise<Map<string, WpRemoteCoreStatus>> {
  if (siteIds.length === 0) return new Map();
  const raw = await wpRemotePaginate<RawCoreSite, "sites">("/sites/wp/wordpress-core", "sites", {
    site_ids: siteIds,
    include_vulnerabilities: true,
  });
  const map = new Map<string, WpRemoteCoreStatus>();
  for (const site of raw) {
    map.set(site.id, {
      currentVersion: site.wp.core.current_version,
      latestVersion: site.wp.core.latest_version,
      updateAvailable: site.wp.core.update_available,
      vulnerabilities: mapVulnerabilities(site.wp.core.security),
    });
  }
  return map;
}

export interface WpRemoteComponent {
  name: string;
  slug: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  vulnerabilities: WpRemoteVulnerability[];
}

interface RawComponentSite<K extends string> {
  id: string;
  wp: Record<K, RawComponent[]>;
}

interface RawComponent {
  name: string;
  slug: string;
  current_version: string | null;
  latest_version: string | null;
  update_available: boolean;
  security?: { vulnerabilities?: RawVulnerability[] };
}

/** Plugin update/vulnerability status for the given sites, keyed by site id. */
export async function fetchWpRemotePlugins(siteIds: string[]): Promise<Map<string, WpRemoteComponent[]>> {
  if (siteIds.length === 0) return new Map();
  const raw = await wpRemotePaginate<RawComponentSite<"plugins">, "sites">("/sites/wp/plugins", "sites", {
    site_ids: siteIds,
    include_vulnerabilities: true,
  });
  const map = new Map<string, WpRemoteComponent[]>();
  for (const site of raw) {
    map.set(
      site.id,
      (site.wp.plugins ?? []).map((p) => ({
        name: p.name,
        slug: p.slug,
        currentVersion: p.current_version,
        latestVersion: p.latest_version,
        updateAvailable: p.update_available,
        vulnerabilities: mapVulnerabilities(p.security),
      })),
    );
  }
  return map;
}

/** Theme update/vulnerability status for the given sites, keyed by site id. */
export async function fetchWpRemoteThemes(siteIds: string[]): Promise<Map<string, WpRemoteComponent[]>> {
  if (siteIds.length === 0) return new Map();
  const raw = await wpRemotePaginate<RawComponentSite<"themes">, "sites">("/sites/wp/themes", "sites", {
    site_ids: siteIds,
    include_vulnerabilities: true,
  });
  const map = new Map<string, WpRemoteComponent[]>();
  for (const site of raw) {
    map.set(
      site.id,
      (site.wp.themes ?? []).map((t) => ({
        name: t.name,
        slug: t.slug,
        currentVersion: t.current_version,
        latestVersion: t.latest_version,
        updateAvailable: t.update_available,
        vulnerabilities: mapVulnerabilities(t.security),
      })),
    );
  }
  return map;
}

export interface WpRemoteDetectionSummary {
  files: number;
  scripts: number;
  plugins: number;
  cronJobs: number;
  redirections: number;
}

/** Unresolved (not marked safe) detection counts per type, for one site. */
export async function fetchWpRemoteDetectionSummary(siteId: string): Promise<WpRemoteDetectionSummary> {
  const data = await wpRemoteRequest<{
    detections: {
      files: { total: number; marked_safe: number };
      scripts: { total: number; marked_safe: number };
      plugins: { total: number };
      cron_jobs: { total: number; marked_safe: number };
      redirections: { total: number; marked_safe: number };
    };
  }>(`/sites/${siteId}/security/scanner/detections/summary`);
  const d = data.detections;
  return {
    files: d.files.total - d.files.marked_safe,
    scripts: d.scripts.total - d.scripts.marked_safe,
    plugins: d.plugins.total,
    cronJobs: d.cron_jobs.total - d.cron_jobs.marked_safe,
    redirections: d.redirections.total - d.redirections.marked_safe,
  };
}

export interface WpRemoteFileDetection {
  id: string;
  path: string;
  detectedAt: string;
  markedSafe: boolean;
}

export async function fetchWpRemoteFileDetections(siteId: string): Promise<WpRemoteFileDetection[]> {
  const raw = await wpRemotePaginate<
    { id: string; path: string; detected_at: string; marked_safe: boolean },
    "files"
  >(`/sites/${siteId}/security/scanner/detections/files`, "files");
  return raw.map((f) => ({ id: f.id, path: f.path, detectedAt: f.detected_at, markedSafe: f.marked_safe }));
}

export interface WpRemoteScriptDetection {
  id: string;
  threatTypes: string[];
  location: Record<string, unknown>;
  detectedAt: string;
  markedSafe: boolean;
}

export async function fetchWpRemoteScriptDetections(siteId: string): Promise<WpRemoteScriptDetection[]> {
  const raw = await wpRemotePaginate<
    { id: string; threat_types: string[]; location: Record<string, unknown>; detected_at: string; marked_safe: boolean },
    "scripts"
  >(`/sites/${siteId}/security/scanner/detections/scripts`, "scripts");
  return raw.map((s) => ({
    id: s.id,
    threatTypes: s.threat_types,
    location: s.location,
    detectedAt: s.detected_at,
    markedSafe: s.marked_safe,
  }));
}

export interface WpRemotePluginDetection {
  name: string;
  slug: string;
  currentVersion: string | null;
  detectedAt: string;
}

export async function fetchWpRemoteMaliciousPlugins(siteId: string): Promise<WpRemotePluginDetection[]> {
  const raw = await wpRemotePaginate<
    { name: string; slug: string; current_version: string | null; malicious: boolean; detected_at: string },
    "plugins"
  >(`/sites/${siteId}/security/scanner/detections/plugins`, "plugins");
  return raw
    .filter((p) => p.malicious)
    .map((p) => ({ name: p.name, slug: p.slug, currentVersion: p.current_version, detectedAt: p.detected_at }));
}

export interface WpRemoteCronJobDetection {
  id: string;
  content: string;
  markedSafe: boolean;
}

export async function fetchWpRemoteCronJobDetections(siteId: string): Promise<WpRemoteCronJobDetection[]> {
  const raw = await wpRemotePaginate<{ id: string; content: string; marked_safe: boolean }, "cron_jobs">(
    `/sites/${siteId}/security/scanner/detections/cron-jobs`,
    "cron_jobs",
  );
  return raw.map((c) => ({ id: c.id, content: c.content, markedSafe: c.marked_safe }));
}

export interface WpRemoteRedirectionDetection {
  type: string;
  from: string;
  to: string;
  detectedAt: string;
  markedSafe: boolean;
}

export async function fetchWpRemoteRedirectionDetections(siteId: string): Promise<WpRemoteRedirectionDetection[]> {
  const raw = await wpRemotePaginate<
    { type: string; from: string; to: string; detected_at: string; marked_safe: boolean },
    "redirections"
  >(`/sites/${siteId}/security/scanner/detections/redirections`, "redirections");
  return raw.map((r) => ({ type: r.type, from: r.from, to: r.to, detectedAt: r.detected_at, markedSafe: r.marked_safe }));
}
