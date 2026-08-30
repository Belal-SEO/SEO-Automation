import { NextResponse } from "next/server";
import { refreshMonthlyReport } from "@/lib/monthlyReportRefresh";

/** Pulls every configured live source (GSC, Sheets, GBP) for this report. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await refreshMonthlyReport(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed." },
      { status: 500 },
    );
  }
}
