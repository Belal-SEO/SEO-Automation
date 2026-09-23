import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { IssueSeverity, IssueSeveritySummary } from "@/lib/types";

const TILES: { key: IssueSeverity; label: string; className: string }[] = [
  { key: "critical", label: "Critical", className: "text-red-600 dark:text-red-400" },
  { key: "high", label: "High", className: "text-orange-600 dark:text-orange-400" },
  { key: "medium", label: "Medium", className: "text-amber-600 dark:text-amber-400" },
  { key: "low", label: "Low", className: "text-slate-600 dark:text-slate-400" },
];

export function OverviewSummaryCard({ summary }: { summary: IssueSeveritySummary }) {
  return (
    <Link href="/overview" className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overview</p>
            <p className="text-2xl font-semibold">{summary.total} open issues</p>
            <p className="text-xs text-muted-foreground">Across all clients — click to filter, assign, and track</p>
          </div>
          <div className="flex flex-wrap gap-5">
            {TILES.map((tile) => (
              <div key={tile.key} className="text-center">
                <p className={`text-lg font-semibold ${tile.className}`}>{summary.bySeverity[tile.key]}</p>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
