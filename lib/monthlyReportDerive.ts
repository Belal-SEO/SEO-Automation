import type { MonthlyReportTask } from "@/lib/monthlyReportTypes";

/** The sendDayOfMonth of the month after periodEnd -- reports go out the month after the period closes. */
export function computeScheduledSendDate(periodEnd: string, sendDayOfMonth: number): string {
  const end = new Date(`${periodEnd}T00:00:00Z`);
  const sendDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, sendDayOfMonth));
  return sendDate.toISOString().slice(0, 10);
}

/** Percent change vs. baseline; null when either side is missing so callers can render "—". */
export function computeGrowthPct(current: number | null, baseline: number): number | null {
  if (current == null) return null;
  if (baseline === 0) return current > 0 ? 100 : 0;
  return ((current - baseline) / baseline) * 100;
}

/** Hero "work delivered" total -- count of non-empty items across every delivered-work list except notes. */
export function computeWorkDeliveredTotal(tasks: MonthlyReportTask[]): number {
  return tasks.filter((t) => t.listKey !== "notes" && t.text.trim().length > 0).length;
}

/** Count of non-empty items in one task list -- powers the work strip. */
export function countByListKey(tasks: MonthlyReportTask[], listKey: MonthlyReportTask["listKey"]): number {
  return tasks.filter((t) => t.listKey === listKey && t.text.trim().length > 0).length;
}
