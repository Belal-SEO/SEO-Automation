// Server-only: extracts actionable tasks from an uploaded audit report
// (PDF or HTML) -- pdf-parse for text extraction, then OpenRouter's
// OpenAI-compatible chat completions API (any model the user configures)
// for structured extraction. Never import from a "use client" component --
// OPENROUTER_API_KEY must stay off the browser.

import { PDFParse } from "pdf-parse";
import { ISSUE_CATEGORY_LABELS, type IssueCategory, type IssueSeverity } from "@/lib/types";

const MAX_REPORT_CHARS = 120_000;

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export type ReportFileType = "pdf" | "html";

export interface ExtractedTask {
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
}

const EXTRACT_TOOL_NAME = "extract_report_tasks";
const VALID_SEVERITIES: IssueSeverity[] = ["critical", "high", "medium", "low"];

function buildTool(allowedCategories: IssueCategory[]) {
  return {
    type: "function" as const,
    function: {
      name: EXTRACT_TOOL_NAME,
      description: "Extract every actionable task, recommendation, or issue found in an audit report.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description:
                    "One clear, specific, actionable task -- what needs to be done, including any page/URL/detail the report names.",
                },
                severity: {
                  type: "string",
                  enum: VALID_SEVERITIES,
                  description: 'Priority as stated or implied by the report. Default to "medium" if unclear.',
                },
                category: {
                  type: "string",
                  enum: allowedCategories,
                },
              },
              required: ["description", "severity", "category"],
            },
          },
        },
        required: ["tasks"],
      },
    },
  };
}

const SYSTEM_PROMPT = `You extract actionable tasks from SEO/website audit reports so they can be imported into a task tracker.

Read the report content and list every distinct actionable item: a fix to make, a recommendation to implement, an issue to resolve. Each task should be self-contained and specific -- include the affected page/URL or detail if the report names one. Do not invent tasks that aren't in the report, and do not merge multiple distinct issues into one task. Skip narrative text, headers, and metrics that aren't actionable items.

Call the extract_report_tasks tool with the full list.`;

function categoryLabelList(categories: IssueCategory[]): string {
  return categories.map((c) => `"${c}" (${ISSUE_CATEGORY_LABELS[c]})`).join(", ");
}

function normalizeSeverity(value: unknown): IssueSeverity {
  return typeof value === "string" && (VALID_SEVERITIES as string[]).includes(value)
    ? (value as IssueSeverity)
    : "medium";
}

/**
 * Extracts a structured task list from an uploaded PDF/HTML audit report.
 * `allowedCategories` constrains what the model may tag each task with --
 * pass just ["sprint_task"] for new-stage clients, or the full technical
 * category set for legacy clients.
 */
export async function extractTasksFromReport(
  buffer: Buffer,
  fileType: ReportFileType,
  allowedCategories: IssueCategory[],
): Promise<ExtractedTask[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  const model = process.env.OPENROUTER_MODEL;
  if (!model) {
    throw new Error(
      "OPENROUTER_MODEL is not configured. Set it to an OpenRouter model slug, e.g. anthropic/claude-3.5-sonnet or openai/gpt-4o.",
    );
  }
  if (allowedCategories.length === 0) {
    throw new Error("No allowed categories were provided for extraction.");
  }

  const rawText = fileType === "pdf" ? await extractPdfText(buffer) : htmlToText(buffer.toString("utf-8"));
  const text = rawText.trim();
  if (!text) {
    throw new Error("Couldn't extract any text from this file -- it may be a scanned/image-only PDF.");
  }
  const truncated = text.length > MAX_REPORT_CHARS ? `${text.slice(0, MAX_REPORT_CHARS)}\n\n[...truncated]` : text;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "SEO Automation Dashboard",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Allowed category values: ${categoryLabelList(allowedCategories)}.\n\nReport content:\n\n${truncated}`,
        },
      ],
      tools: [buildTool(allowedCategories)],
      tool_choice: { type: "function", function: { name: EXTRACT_TOOL_NAME } },
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${res.status}): ${raw || "no error body"}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("The model didn't return a structured task list.");
  }

  let parsed: { tasks?: unknown };
  try {
    parsed = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error("The model's response wasn't valid JSON.");
  }
  if (!Array.isArray(parsed.tasks)) {
    throw new Error("The model's response didn't include a tasks array.");
  }

  const allowedSet = new Set(allowedCategories);
  const tasks: ExtractedTask[] = [];
  for (const raw of parsed.tasks) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const description = typeof t.description === "string" ? t.description.trim() : "";
    if (!description) continue;
    const category = allowedSet.has(t.category as IssueCategory) ? (t.category as IssueCategory) : allowedCategories[0];
    tasks.push({ description, severity: normalizeSeverity(t.severity), category });
  }

  if (tasks.length === 0) {
    throw new Error("No actionable tasks were found in this report.");
  }

  return tasks;
}
