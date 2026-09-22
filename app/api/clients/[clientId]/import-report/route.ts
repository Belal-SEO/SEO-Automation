import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractTasksFromText } from "@/lib/openRouterImport";
import { ISSUE_CATEGORY_LABELS, type IssueCategory } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALL_CATEGORIES = Object.keys(ISSUE_CATEGORY_LABELS) as IssueCategory[];
const LEGACY_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== "sprint_task");
const NEW_CATEGORIES: IssueCategory[] = ["sprint_task"];

/** Extracts a task list from pasted audit report text -- no DB writes here, the client reviews before creating. */
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

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Paste some report text first." }, { status: 400 });
    }

    const allowedCategories = clientRow.stage === "new" ? NEW_CATEGORIES : LEGACY_CATEGORIES;

    const tasks = await extractTasksFromText(text, allowedCategories);
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed." }, { status: 500 });
  }
}
