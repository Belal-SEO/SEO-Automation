"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatDate } from "@/lib/utils";
import type { GscTrendPoint } from "@/lib/googleReporting";

export function GscTrendChart({ points }: { points: GscTrendPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough Search Console history yet to plot a trend.</p>;
  }

  return (
    <div>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => formatDate(d)} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(d) => formatDate(String(d))} />
            <Legend />
            <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            <Line
              type="monotone"
              dataKey="impressions"
              name="Impressions"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Clicks and impressions by date</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Clicks</th>
            <th>Impressions</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatDate(p.date)}</td>
              <td>{p.clicks}</td>
              <td>{p.impressions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
