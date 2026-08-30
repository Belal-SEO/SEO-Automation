// Self-hosted Google Fonts for the Monthly Report editor, matching the
// SEO_Progress_Report design template exactly (DM Serif Display for
// headings, DM Sans for everything else). Scoped to the report page only
// via CSS variables -- the rest of the dashboard keeps its current look.
import { DM_Serif_Display, DM_Sans } from "next/font/google";

export const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
});

export const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
