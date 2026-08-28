import Anthropic from "@anthropic-ai/sdk";
import type { Client, Issue, MetricSnapshot } from "@/lib/types";

const REPORT_MODEL = "claude-sonnet-5";

export interface ReportDraftInput {
  client: Client;
  periodStart: string;
  periodEnd: string;
  fixedIssues: Issue[];
  openIssues: Issue[];
  metricDeltas: { metric: string; before: number | null; after: number | null }[];
}

const SYSTEM_PROMPT = `You are drafting a monthly technical SEO update for a marketing agency's client.
Ground every claim strictly in the structured audit data provided in the user message — never invent
numbers, pages, or fixes that are not in the data.

Tone: plain language, outcome-framed (visibility, site speed, user experience), never raw keyword
rankings or SEO jargon. Write as if explaining "here is what we fixed and why it matters" to a
non-technical clinic owner. Keep it warm but concrete — cite specific pages and before/after numbers
when they are available.

Output clean Markdown with this structure:
1. A one-paragraph summary of the period's outcome.
2. "What we fixed" — bullet list, each tied to a real issue from the data.
3. "Site health trends" — before/after Core Web Vitals if metric data is present.
4. "What's next" — top open issues, framed as the team's next priority, not the client's fault.

If there is no data for a section (e.g. no metric deltas), omit that section rather than fabricating it.`;

export async function generateReportDraft(input: ReportDraftInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({ apiKey });

  const userPayload = {
    client: { name: input.client.name, brand: input.client.brand, domain: input.client.domain },
    period: { start: input.periodStart, end: input.periodEnd },
    fixedIssues: input.fixedIssues.map((i) => ({
      category: i.category,
      severity: i.severity,
      url: i.url,
      description: i.description,
      detectedAt: i.detectedAt,
      fixedAt: i.fixedAt,
      hasBeforeAfterScreenshots: Boolean(i.beforeScreenshotUrl && i.afterScreenshotUrl),
    })),
    stillOpenIssues: input.openIssues.map((i) => ({
      category: i.category,
      severity: i.severity,
      url: i.url,
      description: i.description,
    })),
    metricDeltas: input.metricDeltas,
  };

  const message = await client.messages.create({
    model: REPORT_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Structured audit data for this report:\n\n${JSON.stringify(userPayload, null, 2)}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for the report draft.");
  }

  return textBlock.text;
}
