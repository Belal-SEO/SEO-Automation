"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface TrendPoint {
  label: string;
  impressions: number | null;
  clicks: number | null;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough history yet to plot a trend — create at least one more report.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="clicks" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
