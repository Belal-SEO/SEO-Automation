// Deno-compatible copy of lib/screamingfrog.ts's CSV parsing (Edge Functions
// can't import from the Next.js app's module graph). Keep the two in sync if
// the Screaming Frog export format or issue-detection rules change.

export type IssueCategory = "cwv" | "broken_link" | "page_structure" | "indexability" | "meta";
export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface ParsedIssue {
  category: IssueCategory;
  severity: IssueSeverity;
  url: string;
  description: string;
}

interface Row {
  address: string;
  statusCode: number;
  indexability: string;
  title1: string;
  titleLength: number;
  metaDescription1: string;
  h1_1: string;
  wordCount: number;
  responseTime: number;
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

export function parseScreamingFrogCsv(csvText: string): Row[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
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
    h1_1: col("H1-1"),
    wordCount: col("Word Count"),
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
      h1_1: str(idx.h1_1),
      wordCount: num(idx.wordCount),
      responseTime: num(idx.responseTime),
    };
  });
}

export function detectIssuesFromCrawl(rows: Row[]): ParsedIssue[] {
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
      issues.push({ category: "meta", severity: "medium", url: row.address, description: "Missing page title." });
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
