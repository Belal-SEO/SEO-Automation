import { NextResponse } from "next/server";
import { getGscAuthUrl } from "@/lib/gscAuth";
import { requireAdmin } from "@/lib/teamAccess";

export const runtime = "nodejs";

/** Sends the browser to Google's consent screen for the Search Console connection. */
export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    const url = getGscAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the Google connection.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
