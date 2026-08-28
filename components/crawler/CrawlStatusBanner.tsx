import { cn } from "@/lib/utils";
import type { AuditStatus } from "@/lib/types";

const STEPS: { status: AuditStatus; label: string }[] = [
  { status: "queued", label: "Queued" },
  { status: "crawling", label: "Crawling" },
  { status: "analyzing", label: "Analyzing" },
  { status: "complete", label: "Complete" },
];

export function CrawlStatusBanner({ status, error }: { status: AuditStatus; error?: string | null }) {
  if (status === "failed") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <p className="font-medium">Crawl failed</p>
        <p className="text-xs opacity-90">{error ?? "Unknown error — check the crawl source and retry."}</p>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm" role="status">
      {STEPS.map((step, i) => (
        <div key={step.status} className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              i < currentIndex && "bg-emerald-500",
              i === currentIndex && "animate-pulse bg-primary",
              i > currentIndex && "bg-muted-foreground/30",
            )}
            aria-hidden="true"
          />
          <span className={cn(i === currentIndex ? "font-medium" : "text-muted-foreground")}>
            {step.label}
          </span>
          {i < STEPS.length - 1 && <span className="text-muted-foreground/40">→</span>}
        </div>
      ))}
    </div>
  );
}
