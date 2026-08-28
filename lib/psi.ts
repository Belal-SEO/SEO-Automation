import type { MetricName } from "@/lib/types";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export interface CoreWebVitals {
  lcp: number | null; // seconds
  cls: number | null;
  inp: number | null; // milliseconds
}

interface PsiResponse {
  lighthouseResult?: {
    audits?: {
      "largest-contentful-paint"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
    };
  };
  loadingExperience?: {
    metrics?: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
      INTERACTION_TO_NEXT_PAINT?: { percentile: number };
    };
  };
}

/**
 * Fetches Core Web Vitals for a URL from PageSpeed Insights. Prefers
 * field data (CrUX, `loadingExperience`) since that reflects real users;
 * falls back to the lab-simulated Lighthouse result when field data is
 * unavailable (e.g. low-traffic pages).
 */
export async function fetchCoreWebVitals(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<CoreWebVitals> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
  });
  if (apiKey) params.set("key", apiKey);

  const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`PageSpeed Insights request failed (${res.status}) for ${url}`);
  }

  const data = (await res.json()) as PsiResponse;
  const field = data.loadingExperience?.metrics;
  const lab = data.lighthouseResult?.audits;

  const lcpMs = field?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? lab?.["largest-contentful-paint"]?.numericValue;
  const cls = field?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null
    ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
    : lab?.["cumulative-layout-shift"]?.numericValue;
  const inp = field?.INTERACTION_TO_NEXT_PAINT?.percentile;

  return {
    lcp: lcpMs != null ? lcpMs / 1000 : null,
    cls: cls ?? null,
    inp: inp ?? null,
  };
}

export function coreWebVitalsToMetrics(vitals: CoreWebVitals): { metric: MetricName; value: number }[] {
  const metrics: { metric: MetricName; value: number }[] = [];
  if (vitals.lcp != null) metrics.push({ metric: "lcp", value: vitals.lcp });
  if (vitals.cls != null) metrics.push({ metric: "cls", value: vitals.cls });
  if (vitals.inp != null) metrics.push({ metric: "inp", value: vitals.inp });
  return metrics;
}
