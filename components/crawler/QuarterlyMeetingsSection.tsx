"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatMeetingDate } from "@/lib/utils";
import type { QuarterlyMeetingItem } from "@/lib/calendarMeetings";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function MeetingRow({ meeting }: { meeting: QuarterlyMeetingItem }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!meeting.id) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("manual_quarterly_meetings").delete().eq("id", meeting.id);
    router.refresh();
  }

  return (
    <li className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{meeting.summary}</p>
        <p className="text-xs text-muted-foreground">{formatMeetingDate(meeting.start, meeting.isFullDay)}</p>
      </div>
      {meeting.id && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
          aria-label={`Remove ${meeting.summary}`}
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
      )}
    </li>
  );
}

function MeetingList({ meetings }: { meetings: QuarterlyMeetingItem[] }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-muted-foreground">No quarterly meetings.</p>;
  }
  return (
    <ul className="space-y-3">
      {meetings.map((m, i) => (
        <MeetingRow key={m.id ?? `cal-${i}`} meeting={m} />
      ))}
    </ul>
  );
}

export function QuarterlyMeetingsSection({
  thisWeek,
  nextWeek,
  error,
}: {
  thisWeek: QuarterlyMeetingItem[];
  nextWeek: QuarterlyMeetingItem[];
  error?: string | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [meetingDate, setMeetingDate] = useState(todayIso());
  const [creating, setCreating] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !meetingDate) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("manual_quarterly_meetings").insert({
      client_name: clientName.trim(),
      meeting_date: meetingDate,
    });
    setClientName("");
    setMeetingDate(todayIso());
    setCreating(false);
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add client"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="min-w-[10rem] flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Client name</label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Meeting date</label>
            <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={creating || !clientName.trim()}>
            {creating ? "Adding…" : "Add"}
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">This week</h3>
          <MeetingList meetings={thisWeek} />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next week</h3>
          <MeetingList meetings={nextWeek} />
        </div>
      </div>
    </div>
  );
}
