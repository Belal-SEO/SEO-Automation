// Pulls "client name + meeting date" from a Google Calendar's private iCal
// feed for this week / next week, shown above Overview on the Client roster
// page. Uses node-ical's expandRecurringEvent, which handles RRULE expansion,
// EXDATE exclusions, and RECURRENCE-ID overrides uniformly for both recurring
// and non-recurring events -- see node_modules/node-ical's own docs/source.
import ical from "node-ical";

export interface UpcomingMeeting {
  summary: string;
  start: Date;
  isFullDay: boolean;
}

const FETCH_TIMEOUT_MS = 8000;

function resolveTextValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "val" in (value as Record<string, unknown>)) {
    return String((value as { val: unknown }).val);
  }
  return "";
}

/**
 * Fetches and parses a Google Calendar ICS feed (public or the "secret
 * address" private feed -- both are plain iCalendar), returning non-cancelled
 * events within [from, to), with recurring events expanded to instances.
 */
export async function fetchMeetingsInRange(icsUrl: string, from: Date, to: Date): Promise<UpcomingMeeting[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let text: string;
  try {
    const res = await fetch(icsUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Calendar fetch failed (${res.status}).`);
    text = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const parsed = ical.sync.parseICS(text);
  const meetings: UpcomingMeeting[] = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== "VEVENT") continue;
    if (component.status === "CANCELLED") continue;

    const instances = ical.expandRecurringEvent(component, { from, to });
    for (const instance of instances) {
      if (instance.event?.status === "CANCELLED") continue;
      const summary = resolveTextValue(instance.summary).trim();
      if (!summary) continue;
      meetings.push({ summary, start: instance.start, isFullDay: instance.isFullDay });
    }
  }

  return meetings.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Monday-Sunday range, `weeksFromNow` weeks out (0 = this week, 1 = next
 * week). Computed in the server's local day boundaries (UTC on Vercel) --
 * close enough for a dashboard glance since business meetings don't land
 * near midnight, not meant to be timezone-exact to the calendar's own zone.
 */
export function getWeekRange(weeksFromNow: number): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (dayOfWeek + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday + weeksFromNow * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}
