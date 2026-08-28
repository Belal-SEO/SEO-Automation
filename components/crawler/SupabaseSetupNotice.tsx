export function SupabaseSetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Almost there</h1>
        <p className="text-sm text-muted-foreground">
          The app is deployed, but it isn&apos;t connected to a Supabase project yet. Set these
          environment variables in your Vercel project (Settings → Environment Variables) and
          redeploy:
        </p>
        <ul className="space-y-1 rounded-md bg-muted/60 p-4 font-mono text-xs">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>SUPABASE_SERVICE_ROLE_KEY</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          See <code className="font-mono text-xs">.env.example</code> and the README for the full
          list (Claude, PageSpeed Insights, and Google credentials) and the migration to apply.
        </p>
      </div>
    </div>
  );
}
