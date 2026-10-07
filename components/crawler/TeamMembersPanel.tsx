"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { TeamMember, TeamRole } from "@/lib/types";

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
];

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<TeamRole>(member.role);
  const [busy, setBusy] = useState<"role" | "remove" | null>(null);

  async function handleRoleChange(newRole: TeamRole) {
    setRole(newRole);
    setBusy("role");
    const supabase = createClient();
    await supabase.from("team_members").update({ role: newRole }).eq("id", member.id);
    setBusy(null);
    router.refresh();
  }

  async function handleRemove() {
    if (!window.confirm(`Remove ${member.email} from the team? They'll lose access immediately.`)) return;
    setBusy("remove");
    const supabase = createClient();
    await supabase.from("team_members").delete().eq("id", member.id);
    router.refresh();
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.email} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground">Added {formatDate(member.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as TeamRole)}
          disabled={busy !== null || isSelf}
          aria-label="Role"
          className="h-8 rounded-md border border-border bg-background px-2 text-sm capitalize"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleRemove}
          disabled={busy !== null || isSelf}
          title={isSelf ? "You can't remove yourself." : undefined}
        >
          {busy === "remove" ? "Removing…" : "Remove"}
        </Button>
      </div>
    </li>
  );
}

export function TeamMembersPanel({ members, currentUserEmail }: { members: TeamMember[]; currentUserEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("editor");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("team_members").insert({ email: trimmed, role });
    setCreating(false);
    if (insertError) {
      setError(insertError.message.includes("duplicate") ? "That email is already on the team." : insertError.message);
      return;
    }
    setEmail("");
    setRole("editor");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={creating || !email.trim()}>
          {creating ? "Adding…" : "Add to team"}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team members yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} isSelf={member.email.toLowerCase() === currentUserEmail.toLowerCase()} />
          ))}
        </ul>
      )}
    </div>
  );
}
