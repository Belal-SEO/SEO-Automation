import { NextResponse } from "next/server";
import { disconnectGscAccount } from "@/lib/gscAuth";
import { requireAdmin } from "@/lib/teamAccess";

export const runtime = "nodejs";

export async function POST() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  try {
    await disconnectGscAccount();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Disconnect failed." }, { status: 500 });
  }
}
