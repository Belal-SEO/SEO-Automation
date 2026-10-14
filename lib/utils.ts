import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { WorkHistoryPeriod } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/** e.g. "Mon, Oct 6, 2:00 PM" -- or just "Mon, Oct 6" for an all-day event. */
export function formatMeetingDate(date: Date, allDay: boolean): string {
  const datePart = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (allDay) return datePart;
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Monday-Sunday/calendar-month date range (server's local day boundaries) for a work-history period filter. null = no filter ("all"). */
export function getWorkHistoryPeriodRange(period: WorkHistoryPeriod): { start: Date; end: Date } | null {
  if (period === "all") return null;

  const now = new Date();
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }

  const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (dayOfWeek + 6) % 7;
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  if (period === "week") {
    const end = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 7);
    return { start: thisMonday, end };
  }
  const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
  return { start, end: thisMonday };
}

export function formatMetric(metric: string, value: number): string {
  switch (metric) {
    case "lcp":
      return `${value.toFixed(2)}s`;
    case "cls":
      return value.toFixed(3);
    case "inp":
      return `${Math.round(value)}ms`;
    case "broken_link_count":
      return `${Math.round(value)}`;
    default:
      return `${value}`;
  }
}
