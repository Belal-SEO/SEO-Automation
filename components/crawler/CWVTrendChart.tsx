"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatDate, formatMetric } from "@/lib/utils";
import type { MetricSnapshot } from "@/lib/types";

const METRIC_COLORS: Record<string, string> = {
  lcp: "#2563eb",
  cls: "#d97706",
  inp: "#059669",
};

const METRIC_LABELS: Record<string, string> = {
  lcp: "LCP (s)",
  cls: "CLS",
  inp: "INP (ms)",
};

interface ChartPoint {
  date: string;
  lcp?: number;
  cls?: number;
  inp?: number;
}

function toChartData(snapshots: MetricSnapshot[]): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>();
  for (const s of snapshots) {
    if (s.metric === "broken_link_count") continue;
    const date = s.capturedAt.slice(0, 10);
    const point = byDate.get(date) ?? { date };
    if (s.metric === "lcp" || s.metric === "cls" || s.metric === "inp") {
      point[s.metric] = s.value;
    }
    byDate.set(date, point);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function CWVTrendChart({ snapshots }: { snapshots: MetricSnapshot[] }) {
  const data = toChartData(snapshots);

  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough audit history yet to plot a trend — run at least two audits.
      </p>
    );
  }

  return (
    <div>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => formatDate(d)} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(d) => formatDate(String(d))} />
            <Legend formatter={(value) => METRIC_LABELS[value] ?? value} />
            {(["lcp", "cls", "inp"] as const).map((metric) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                name={metric}
                stroke={METRIC_COLORS[metric]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Text/table equivalent so trend data isn't encoded in color alone */}
      <table className="sr-only">
        <caption>Core Web Vitals by audit date</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>LCP</th>
            <th>CLS</th>
            <th>INP</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{formatDate(row.date)}</td>
              <td>{row.lcp != null ? formatMetric("lcp", row.lcp) : "—"}</td>
              <td>{row.cls != null ? formatMetric("cls", row.cls) : "—"}</td>
              <td>{row.inp != null ? formatMetric("inp", row.inp) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
