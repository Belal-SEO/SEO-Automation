// Color + typography constants for the Monthly Report editor, lifted
// directly from the SEO_Progress_Report.dc.html design reference so the
// live editor renders pixel-for-pixel the same palette.

export const REPORT_COLORS = {
  pageBg: "#e7e4dd",
  cardBg: "#fff",
  toolbarBg: "#faf9f6",
  subtleBg: "#faf9f6",
  subtleBg2: "#fcfbf9",
  darkTeal: "#003d38",
  midTeal: "#00897b",
  tealHover: "#005f56",
  orange: "#e8500a",
  text: "#1a1a1a",
  textSecondary: "#666",
  muted: "#999",
  mutedLight: "#aaa",
  border: "rgba(0,0,0,.09)",
  borderLight: "rgba(0,0,0,.07)",
  borderCard: "rgba(0,0,0,.08)",
  borderInput: "#e5e3de",
  pillBg: "#eeece8",
  badgeGreenBg: "#dcfce7",
  badgeGreenText: "#166534",
  badgeRedBg: "#fee2e2",
  badgeRedText: "#991b1b",
} as const;

export interface ReportAccent {
  accent: string;
  accentBg: string;
}

// Same 3-color cycle the template uses for its Month 1 / 2 / 3 sections
// (blue, orange, teal) -- we cycle it per report in creation order.
export const ACCENT_PALETTE: ReportAccent[] = [
  { accent: "#1565c0", accentBg: "#e3f2fd" },
  { accent: "#e8500a", accentBg: "#fff3e0" },
  { accent: "#00897b", accentBg: "#e0f7f4" },
];

export function accentForIndex(index: number): ReportAccent {
  return ACCENT_PALETTE[((index % ACCENT_PALETTE.length) + ACCENT_PALETTE.length) % ACCENT_PALETTE.length];
}

/** Looks up the matching tint for a stored accent hex, e.g. for a report created before the palette existed. */
export function accentBgFor(accentColor: string): string {
  const match = ACCENT_PALETTE.find((p) => p.accent.toLowerCase() === accentColor.toLowerCase());
  return match?.accentBg ?? "#e0f7f4";
}
