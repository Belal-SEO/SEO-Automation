// Supabase Edge Function: send-report
//
// Delivers an approved report via Gmail or saves it to Drive, then marks it
// sent. Mirrors the logic in app/api/reports/route.ts (POST) so scheduled/
// automated sends don't require the Next.js app. Requires Google OAuth
// credentials with Gmail send + Drive file scopes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SendReportPayload {
  reportId: string;
  sendVia: "gmail" | "drive";
  recipientEmail?: string;
}

async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh Google access token (${res.status}).`);
  const data = await res.json();
  return data.access_token as string;
}

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const payload: SendReportPayload = await req.json().catch(() => ({} as SendReportPayload));
  if (!payload.reportId || !payload.sendVia) {
    return new Response(JSON.stringify({ error: "reportId and sendVia are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: report } = await supabase.from("reports").select("*").eq("id", payload.reportId).single();
    if (!report) throw new Error("Report not found.");
    if (report.status !== "approved") throw new Error("A report can't be sent while it's still a draft.");

    const { data: client } = await supabase.from("clients").select("*").eq("id", report.client_id).single();
    if (!client) throw new Error("Client not found.");

    const accessToken = await getGoogleAccessToken();
    const subject = `${client.brand} — Technical SEO Update (${report.period_start} to ${report.period_end})`;

    if (payload.sendVia === "gmail") {
      if (!payload.recipientEmail) throw new Error("recipientEmail is required to send via Gmail.");
      const html = report.content.replace(/\n/g, "<br/>");
      const raw = toBase64Url(
        [
          `To: ${payload.recipientEmail}`,
          `Subject: ${subject}`,
          "Content-Type: text/html; charset=utf-8",
          "MIME-Version: 1.0",
          "",
          html,
        ].join("\r\n"),
      );
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) throw new Error(`Gmail send failed (${res.status}): ${await res.text()}`);
    } else {
      const folderId = Deno.env.get("GOOGLE_DRIVE_REPORTS_FOLDER_ID");
      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "multipart/related; boundary=seo_boundary" },
        body: [
          "--seo_boundary",
          "Content-Type: application/json; charset=UTF-8",
          "",
          JSON.stringify({
            name: subject,
            mimeType: "application/vnd.google-apps.document",
            parents: folderId ? [folderId] : undefined,
          }),
          "--seo_boundary",
          "Content-Type: text/markdown",
          "",
          report.content,
          "--seo_boundary--",
        ].join("\r\n"),
      });
      if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`);
    }

    await supabase
      .from("reports")
      .update({ status: "sent", sent_via: payload.sendVia, sent_at: new Date().toISOString() })
      .eq("id", payload.reportId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
