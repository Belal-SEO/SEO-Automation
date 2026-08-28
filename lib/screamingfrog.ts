import { spawn } from "node:child_process";
import type { IssueCategory, IssueSeverity } from "@/lib/types";

/**
 * Ingests Screaming Frog CLI exports. The CLI itself only runs on a machine
 * with a licensed install (see PRD Q3) — typically a scheduled job outside
 * Vercel's serverless runtime. `runScreamingFrogCrawl` is provided for that
 * self-hosted runner; the Next.js app itself only parses whatever CSV export
 * gets uploaded (via `/api/crawl` or an Edge Function).
 */

export interface ScreamingFrogRow {
  address: string;
  statusCode: number;
  indexability: string;
  title1: string;
  titleLength: number;
  metaDescription1: string;
  metaDescriptionLength: number;
  h1_1: string;
  wordCount: number;
  inlinks: number;
  outlinks: number;
  responseTime: number;
}

export interface ParsedIssue {
  category: IssueCategory;
  severity: IssueSeverity;
  url: string;
  description: string;
}

/** Parses the "internal_all.csv" export from a Screaming Frog crawl. */
export function parseScreamingFrogCsv(csvText: string): ScreamingFrogRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => headers.indexOf(name);

  const idx = {
    address: col("Address"),
    statusCode: col("Status Code"),
    indexability: col("Indexability"),
    title1: col("Title 1"),
    titleLength: col("Title 1 Length"),
    metaDescription1: col("Meta Description 1"),
    metaDescriptionLength: col("Meta Description 1 Length"),
    h1_1: col("H1-1"),
    wordCount: col("Word Count"),
    inlinks: col("Inlinks"),
    outlinks: col("Outlinks"),
    responseTime: col("Response Time"),
  };

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const num = (i: number) => (i >= 0 ? Number(cells[i]) || 0 : 0);
    const str = (i: number) => (i >= 0 ? cells[i] ?? "" : "");

    return {
      address: str(idx.address),
      statusCode: num(idx.statusCode),
      indexability: str(idx.indexability),
      title1: str(idx.title1),
      titleLength: num(idx.titleLength),
      metaDescription1: str(idx.metaDescription1),
      metaDescriptionLength: num(idx.metaDescriptionLength),
      h1_1: str(idx.h1_1),
      wordCount: num(idx.wordCount),
      inlinks: num(idx.inlinks),
      outlinks: num(idx.outlinks),
      responseTime: num(idx.responseTime),
    };
  });
}

/** Categorizes crawl rows into audit issues (broken links, meta, structure, indexability). */
export function detectIssuesFromCrawl(rows: ScreamingFrogRow[]): ParsedIssue[] {
  const issues: ParsedIssue[] = [];

  for (const row of rows) {
    if (row.statusCode >= 400) {
      issues.push({
        category: "broken_link",
        severity: row.statusCode >= 500 ? "critical" : "high",
        url: row.address,
        description: `Page returns HTTP ${row.statusCode}.`,
      });
    }

    if (/non-indexable/i.test(row.indexability)) {
      issues.push({
        category: "indexability",
        severity: "high",
        url: row.address,
        description: `Page is non-indexable (${row.indexability}).`,
      });
    }

    if (!row.title1) {
      issues.push({
        category: "meta",
        severity: "medium",
        url: row.address,
        description: "Missing page title.",
      });
    } else if (row.titleLength > 60) {
      issues.push({
        category: "meta",
        severity: "low",
        url: row.address,
        description: `Title is ${row.titleLength} characters (over the 60-character guideline).`,
      });
    }

    if (!row.metaDescription1) {
      issues.push({
        category: "meta",
        severity: "medium",
        url: row.address,
        description: "Missing meta description.",
      });
    }

    if (!row.h1_1) {
      issues.push({
        category: "page_structure",
        severity: "medium",
        url: row.address,
        description: "Missing H1 heading.",
      });
    }

    if (row.wordCount > 0 && row.wordCount < 100) {
      issues.push({
        category: "page_structure",
        severity: "low",
        url: row.address,
        description: `Thin content: only ${row.wordCount} words.`,
      });
    }

    if (row.responseTime > 1.5) {
      issues.push({
        category: "cwv",
        severity: row.responseTime > 3 ? "high" : "medium",
        url: row.address,
        description: `Slow server response time: ${row.responseTime.toFixed(2)}s.`,
      });
    }
  }

  return issues;
}

/**
 * Invokes the Screaming Frog CLI headlessly. Only usable on a runner with a
 * licensed install (`SCREAMING_FROG_CLI_PATH`). Writes the crawl export to
 * `outputDir` for the caller to read and parse with `parseScreamingFrogCsv`.
 */
export async function runScreamingFrogCrawl(domain: string, outputDir: string): Promise<void> {
  const cliPath = process.env.SCREAMING_FROG_CLI_PATH;
  if (!cliPath) {
    throw new Error(
      "SCREAMING_FROG_CLI_PATH is not configured — this runner cannot execute crawls.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(cliPath, [
      "--crawl",
      domain,
      "--headless",
      "--save-crawl",
      "--output-folder",
      outputDir,
      "--export-tabs",
      "Internal:All",
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Screaming Frog CLI exited with code ${code}: ${stderr}`));
    });
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
