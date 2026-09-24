import { NextResponse } from "next/server";
import { disconnectGscAccount } from "@/lib/gscAuth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await disconnectGscAccount();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Disconnect failed." }, { status: 500 });
  }
}
