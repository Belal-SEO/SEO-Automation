import { Card, CardContent } from "@/components/ui/card";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5 text-center">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function HeroStats({
  workDelivered,
  impressionsGrowth,
  clicksGrowth,
}: {
  workDelivered: number;
  impressionsGrowth: number | null;
  clicksGrowth: number | null;
}) {
  const growthLabel = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatTile label="Work delivered this period" value={String(workDelivered)} />
      <StatTile label="Impressions growth vs. baseline" value={growthLabel(impressionsGrowth)} />
      <StatTile label="Clicks growth vs. baseline" value={growthLabel(clicksGrowth)} />
    </div>
  );
}
