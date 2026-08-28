import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
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
