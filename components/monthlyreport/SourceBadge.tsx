import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { MetricSource } from "@/lib/monthlyReportTypes";

const SOURCE_META: Record<MetricSource, { icon: string; label: string; className: string }> = {
  gsc: {
    icon: "⚡",
    label: "GSC",
    className: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  sheet: {
    icon: "📄",
    label: "Sheet",
    className:
      "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
  },
  gbp: {
    icon: "📍",
    label: "GBP",
    className:
      "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  },
  manual: {
    icon: "✎",
    label: "Manual",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function SourceBadge({
  source,
  isOverridden,
  fetchedAt,
}: {
  source: MetricSource;
  isOverridden: boolean;
  fetchedAt: string | null;
}) {
  const meta = SOURCE_META[source];
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <Badge className={cn(meta.className, "gap-1")}>
        <span aria-hidden="true">{meta.icon}</span>
        {meta.label}
        {isOverridden && " (overridden)"}
      </Badge>
      {fetchedAt && source !== "manual" && (
        <span className="text-muted-foreground">fetched {formatDate(fetchedAt)}</span>
      )}
    </span>
  );
}
