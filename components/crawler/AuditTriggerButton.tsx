"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CUSTOM = "__custom__";

const MODEL_OPTIONS = [
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "openai/gpt-5.4", label: "GPT-5.4" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: CUSTOM, label: "Custom model slug…" },
];

export function AuditTriggerButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [customModel, setCustomModel] = useState("");
  const [status, setStatus] = useState<"idle" | "starting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const resolvedModel = model === CUSTOM ? customModel.trim() : model;

  async function handleStart() {
    if (!resolvedModel) return;
    setStatus("starting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, model: resolvedModel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setOpen(false);
      router.refresh();
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start crawl.");
      setStatus("error");
    }
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} size="sm">
        Run crawl now
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-64 space-y-2 rounded-md border border-border bg-background p-3 shadow-md">
          <label className="text-xs font-medium text-muted-foreground">Model (via OpenRouter)</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {model === CUSTOM && (
            <Input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. google/gemini-2.5-pro"
              className="text-sm"
            />
          )}
          <Button
            size="sm"
            className="w-full"
            onClick={handleStart}
            disabled={status === "starting" || !resolvedModel}
          >
            {status === "starting" ? "Starting…" : "Start crawl"}
          </Button>
          {status === "error" && <p className="text-xs text-destructive">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}
