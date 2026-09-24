// Search Console-specific OAuth: a self-serve "Connect Search Console" flow
// for the shared agency Google account, storing its refresh token encrypted
// in google_oauth_tokens instead of a static GOOGLE_REFRESH_TOKEN env var.
// Deliberately separate from lib/google.ts's getOAuthClient() (which still
// powers Gmail/Drive/Sheets/GBP off the existing env-var token) -- GSC is
// the only scope this new flow requests.

import { google } from "googleapis";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/tokenCrypto";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_ROW_ID = "agency";

function requireEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_REDIRECT_URI"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function buildOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI"),
  );
}

/** URL to send the browser to for the Google consent screen. */
export function getGscAuthUrl(): string {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on a re-connect
    scope: [GSC_SCOPE],
  });
}

/** Exchanges the callback's `code` for tokens and stores the refresh token encrypted. */
export async function connectGscAccount(code: string): Promise<{ email: string | null }> {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. If this account was connected before, revoke access at https://myaccount.google.com/permissions and try again.",
    );
  }

  client.setCredentials(tokens);
  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userinfo = await oauth2.userinfo.get();
    email = userinfo.data.email ?? null;
  } catch {
    // Non-fatal -- connection still works without a display email.
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("google_oauth_tokens").upsert({
    id: TOKEN_ROW_ID,
    encrypted_refresh_token: encryptToken(tokens.refresh_token),
    google_account_email: email,
    scope: GSC_SCOPE,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  return { email };
}

export async function disconnectGscAccount(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("google_oauth_tokens").delete().eq("id", TOKEN_ROW_ID);
  if (error) throw error;
}

export interface GscConnectionStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

/** Read-only status for display -- never returns the token itself. */
export async function getGscConnectionStatus(): Promise<GscConnectionStatus> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("google_oauth_tokens")
    .select("google_account_email, connected_at")
    .eq("id", TOKEN_ROW_ID)
    .maybeSingle();

  if (!data) return { connected: false, email: null, connectedAt: null };
  return { connected: true, email: data.google_account_email, connectedAt: data.connected_at };
}

/** Auth client for GSC API calls, built from the stored encrypted refresh token. Throws if not connected. */
export async function getGscOAuthClient() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("google_oauth_tokens")
    .select("encrypted_refresh_token")
    .eq("id", TOKEN_ROW_ID)
    .maybeSingle();

  if (!data) {
    throw new Error('Search Console isn\'t connected yet -- go to "Connect Search Console" on the client roster page.');
  }

  const client = buildOAuthClient();
  client.setCredentials({ refresh_token: decryptToken(data.encrypted_refresh_token) });
  return client;
}
