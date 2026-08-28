import { Button } from "@/components/ui/button";

export function ErrorState({
  source,
  message,
  onRetry,
}: {
  source: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-5"
    >
      <p className="text-sm font-medium text-destructive">Couldn&apos;t reach {source}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
