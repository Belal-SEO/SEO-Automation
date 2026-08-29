import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE callback for magic-link sign-in. Supabase's hosted /verify endpoint
 * redirects here with a `code` param after the user clicks the email link;
 * this exchanges it for a session (setting auth cookies) before sending the
 * user on to their destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/clients";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "Could not sign you in. Request a fresh magic link.");
  return NextResponse.redirect(loginUrl);
}
