"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { GscConnectionStatus } from "@/lib/gscAuth";

export function GscConnectionCard({ status }: { status: GscConnectionStatus }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Search Console? Monthly report GSC pulls will stop working until reconnected.")) {
      return;
    }
    setDisconnecting(true);
    await fetch("/api/gsc/disconnect", { method: "POST" });
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Console</CardTitle>
        <CardDescription>
          One shared Google account powers GSC data for every client — add it as a user on each client&apos;s
          Search Console property, same as before.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {status.connected ? (
          <>
            <div className="text-sm">
              <p className="font-medium text-emerald-600">Connected{status.email ? ` as ${status.email}` : ""}</p>
              {status.connectedAt && (
                <p className="text-xs text-muted-foreground">Since {formatDate(status.connectedAt)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <a href="/api/gsc/connect">
                <Button size="sm" variant="secondary">
                  Reconnect
                </Button>
              </a>
              <Button size="sm" variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Not connected — GSC pulls in Monthly Reports will fail.</p>
            <a href="/api/gsc/connect">
              <Button size="sm">Connect Search Console</Button>
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
