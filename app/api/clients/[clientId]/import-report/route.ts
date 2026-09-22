import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractTasksFromReport, type ReportFileType } from "@/lib/openRouterImport";
import { ISSUE_CATEGORY_LABELS, type IssueCategory } from "@/lib/types";

export const runtime = "nodejs";
// PDF parsing + the OpenRouter extraction call can run well past Vercel's
// default function timeout, especially for longer reports -- 60s is the max
// configurable duration on Hobby, and comfortably covers this on Pro too.
export const maxDuration = 60;

const ALL_CATEGORIES = Object.keys(ISSUE_CATEGORY_LABELS) as IssueCategory[];
const LEGACY_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== "sprint_task");
const NEW_CATEGORIES: IssueCategory[] = ["sprint_task"];

const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Extracts a task list from an uploaded PDF/HTML audit report -- no DB writes here, the client reviews before creating. */
export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  try {
    const supabase = createServiceRoleClient();
    const { data: clientRow, error } = await supabase
      .from("clients")
      .select("stage")
      .eq("id", params.clientId)
      .maybeSingle();
    if (error) throw error;
    if (!clientRow) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (max 15MB)." }, { status: 400 });
    }

    const nameLower = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || nameLower.endsWith(".pdf");
    const isHtml = file.type.includes("html") || nameLower.endsWith(".html") || nameLower.endsWith(".htm");
    if (!isPdf && !isHtml) {
      return NextResponse.json({ error: "Only PDF or HTML files are supported." }, { status: 400 });
    }
    const fileType: ReportFileType = isPdf ? "pdf" : "html";

    const buffer = Buffer.from(await file.arrayBuffer());
    const allowedCategories = clientRow.stage === "new" ? NEW_CATEGORIES : LEGACY_CATEGORIES;

    const tasks = await extractTasksFromReport(buffer, fileType, allowedCategories);
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed." }, { status: 500 });
  }
}
