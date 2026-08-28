import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IssueSeverity } from "@/lib/types";

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  critical: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  high: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  medium: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  low: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

const SEVERITY_ICON: Record<IssueSeverity, string> = {
  critical: "●●●",
  high: "●●",
  medium: "●",
  low: "○",
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <Badge className={cn(SEVERITY_STYLES[severity], "gap-1.5 capitalize")}>
      <span aria-hidden="true" className="text-[0.6rem] leading-none">
        {SEVERITY_ICON[severity]}
      </span>
      {severity}
    </Badge>
  );
}
