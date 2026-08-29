import { google } from "googleapis";
import type { Client, Report } from "@/lib/types";

export function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Google OAuth credentials are not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).",
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

function markdownToHtml(markdown: string): string {
  // Minimal, dependency-free conversion sufficient for report drafts
  // (headings, bold, bullet lists, paragraphs). Swap for a proper
  // markdown renderer if drafts grow more complex.
  return markdown
    .split("\n\n")
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${block.slice(4)}</h3>`;
      if (block.startsWith("## ")) return `<h2>${block.slice(3)}</h2>`;
      if (block.startsWith("# ")) return `<h1>${block.slice(2)}</h1>`;
      if (block.trim().startsWith("- ")) {
        const items = block
          .split("\n")
          .filter((line) => line.trim().startsWith("- "))
          .map((line) => `<li>${line.trim().slice(2)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function buildMimeMessage(to: string, subject: string, html: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    html,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendReportEmail(
  client: Client,
  report: Report,
  recipientEmail: string,
): Promise<{ messageId: string }> {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const subject = `${client.brand} — Technical SEO Update (${report.periodStart} to ${report.periodEnd})`;
  const raw = buildMimeMessage(recipientEmail, subject, markdownToHtml(report.content));

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  if (!res.data.id) {
    throw new Error("Gmail API did not return a message id.");
  }
  return { messageId: res.data.id };
}

export async function saveReportToDrive(
  client: Client,
  report: Report,
): Promise<{ fileId: string; webViewLink: string | null }> {
  const auth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const folderId = process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID;
  const name = `${client.brand} — Technical SEO Update (${report.periodStart} to ${report.periodEnd})`;

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: "text/markdown",
      body: report.content,
    },
    fields: "id, webViewLink",
  });

  if (!res.data.id) {
    throw new Error("Drive API did not return a file id.");
  }
  return { fileId: res.data.id, webViewLink: res.data.webViewLink ?? null };
}
