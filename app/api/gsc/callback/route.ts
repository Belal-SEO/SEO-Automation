import { NextResponse } from "next/server";
import { connectGscAccount } from "@/lib/gscAuth";

export const runtime = "nodejs";

/** Google redirects here after consent; exchanges the code and stores the encrypted refresh token. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const redirectTo = new URL("/clients", origin);

  if (error) {
    redirectTo.searchParams.set("gsc_error", error);
    return NextResponse.redirect(redirectTo);
  }
  if (!code) {
    redirectTo.searchParams.set("gsc_error", "missing_code");
    return NextResponse.redirect(redirectTo);
  }

  try {
    await connectGscAccount(code);
    redirectTo.searchParams.set("gsc_connected", "1");
  } catch (err) {
    redirectTo.searchParams.set("gsc_error", err instanceof Error ? err.message : "connect_failed");
  }

  return NextResponse.redirect(redirectTo);
}
