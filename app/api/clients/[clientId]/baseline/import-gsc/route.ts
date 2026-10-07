import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { importBaselineFromGsc } from "@/lib/baselineImport";
import { requireAdmin } from "@/lib/teamAccess";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Pulls impressions/clicks, top 3 pages, and sitemap info from Search Console into this client's baseline. */
export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const body = await request.json().catch(() => null);
    const siteUrl = typeof body?.siteUrl === "string" ? body.siteUrl.trim() : "";
    const startDate = typeof body?.startDate === "string" ? body.startDate : "";
    const endDate = typeof body?.endDate === "string" ? body.endDate : "";

    if (!siteUrl) return NextResponse.json({ error: "A Search Console property URL is required." }, { status: 400 });
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "A start and end date are required." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const baseline = await importBaselineFromGsc(supabase, params.clientId, siteUrl, startDate, endDate);
    return NextResponse.json({ baseline });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed." }, { status: 500 });
  }
}
