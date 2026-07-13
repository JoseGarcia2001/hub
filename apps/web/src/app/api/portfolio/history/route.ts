import { NextResponse } from "next/server";
import { investments } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Historia de snapshots del portafolio (JSON), para consumidores máquina —
 * el informe semanal calcula deltas y top movers contra esta serie.
 * `?days=N` (default 8, máx 90).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const raw = new URL(req.url).searchParams.get("days");
  const days = Math.min(Math.max(Number(raw ?? 8) || 8, 1), 90);
  const snapshots = await investments.getOwnerHistory(days);
  return NextResponse.json({ days, count: snapshots.length, snapshots });
}
