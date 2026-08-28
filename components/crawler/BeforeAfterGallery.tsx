import Image from "next/image";
import { EmptyState } from "@/components/crawler/EmptyState";
import { formatDate } from "@/lib/utils";
import type { Issue } from "@/lib/types";

export function BeforeAfterGallery({ issues }: { issues: Issue[] }) {
  const withScreenshots = issues.filter((i) => i.beforeScreenshotUrl && i.afterScreenshotUrl);

  if (withScreenshots.length === 0) {
    return (
      <EmptyState
        title="No before/after captures yet"
        description="Screenshots attach automatically when a fixed issue has both a before and after capture."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {withScreenshots.map((issue) => (
        <div key={issue.id} className="rounded-lg border border-border p-3">
          <p className="mb-2 truncate text-sm font-medium" title={issue.url}>
            {issue.url}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <figure>
              <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
                <Image
                  src={issue.beforeScreenshotUrl!}
                  alt={`Before fix: ${issue.description}`}
                  fill
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-1 text-center text-xs text-muted-foreground">Before</figcaption>
            </figure>
            <figure>
              <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
                <Image
                  src={issue.afterScreenshotUrl!}
                  alt={`After fix: ${issue.description}`}
                  fill
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-1 text-center text-xs text-muted-foreground">After</figcaption>
            </figure>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Fixed {formatDate(issue.fixedAt)} · {issue.description}
          </p>
        </div>
      ))}
    </div>
  );
}
