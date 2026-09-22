import Anthropic from "@anthropic-ai/sdk";
import { ISSUE_CATEGORY_LABELS, type Client, type Issue } from "@/lib/types";
import type { Baseline, MonthlyReport, MonthlyReportMetric } from "@/lib/monthlyReportTypes";
import { computeGrowthPct } from "@/lib/monthlyReportDerive";

const EMAIL_MODEL = "claude-sonnet-5";

const EMAIL_TOOL = {
  name: "draft_client_email",
  description: "Draft the monthly progress email to send to the client.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
    },
    required: ["subject", "body"],
  },
};

const SYSTEM_PROMPT = `You are drafting a monthly SEO progress email for a marketing agency's client.
Ground every claim strictly in the structured data provided -- never invent numbers, pages, or work
that isn't in the data.

Tone: warm, plain language, outcome-framed (visibility, growth, leads) -- never raw keyword rankings
or SEO jargon. Write as if the account manager is personally updating a client they like working with.
Keep it concise: a greeting, 1-2 sentences on the period's headline result, a short list of what was
delivered, and a warm sign-off. This is an email body, not a full report -- the full report is attached
or linked separately, so don't try to restate every metric.

Every item in "Delivered work" has been verified complete by the team member who owned it -- state these
as finished work, not work in progress. If "Delivered work" is empty, don't imply any items shipped --
lean on the metrics instead, or keep the update brief.

Return only subject and body via the draft_client_email tool. The body should be plain text with blank
lines between paragraphs (no markdown headers or HTML).`;

export interface GenerateEmailDraftInput {
  client: Client;
  report: MonthlyReport;
  baseline: Baseline | null;
  metrics: MonthlyReportMetric[];
  completedAssignedIssues: Issue[];
}

export async function generateEmailDraft(input: GenerateEmailDraftInput): Promise<{ subject: string; body: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const anthropic = new Anthropic({ apiKey });

  const metricSummary = input.metrics.map((m) => {
    const baselineValue =
      input.baseline &&
      (m.key === "impressions"
        ? input.baseline.organicImpressions
        : m.key === "clicks"
          ? input.baseline.organicClicks
          : m.key === "pages_indexed"
            ? input.baseline.indexedPages
            : m.key === "backlinks_built"
              ? input.baseline.totalBacklinks
              : null);
    return {
      label: m.label,
      value: m.valueNumber ?? m.valueText,
      growthPct: baselineValue != null ? computeGrowthPct(m.valueNumber, baselineValue) : null,
    };
  });

  const deliveredWork = input.completedAssignedIssues.map((i) => ({
    category: ISSUE_CATEGORY_LABELS[i.category],
    description: i.description,
  }));

  const message = await anthropic.messages.create({
    model: EMAIL_MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    tools: [EMAIL_TOOL],
    tool_choice: { type: "tool", name: "draft_client_email" },
    messages: [
      {
        role: "user",
        content: `Client: ${input.client.name} (${input.client.brand})
Report period: ${input.report.periodLabel} (${input.report.periodStart} to ${input.report.periodEnd})

Metrics:
${JSON.stringify(metricSummary, null, 2)}

Delivered work this period:
${JSON.stringify(deliveredWork, null, 2)}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured email draft.");
  }
  const output = toolUse.input as { subject?: string; body?: string };
  if (!output.subject || !output.body) {
    throw new Error("Claude's email draft was missing a subject or body.");
  }
  return { subject: output.subject, body: output.body };
}
