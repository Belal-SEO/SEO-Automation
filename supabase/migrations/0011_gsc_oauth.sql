-- Self-serve "Connect Search Console" OAuth flow for the shared agency
-- Google account. Replaces manually minting a refresh token and pasting it
-- into GOOGLE_REFRESH_TOKEN -- the token now lives here, encrypted at rest
-- (see lib/tokenCrypto.ts), and can be reconnected from the UI if revoked.
-- Singleton row (id='agency') since this is one shared account, not per-client.

create table if not exists public.google_oauth_tokens (
  id text primary key default 'agency',
  encrypted_refresh_token text not null,
  google_account_email text,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;

create policy "team_read_google_oauth_tokens" on public.google_oauth_tokens
  for select to authenticated using (true);
