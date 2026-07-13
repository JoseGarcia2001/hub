import { NextResponse } from "next/server";
import { reports } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Último informe semanal (JSON), para consumidores máquina — el agente asesor
 * lo lee al generar el siguiente informe (continuidad semana a semana).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await reports.getOwnerLatest();
  if (!report) {
    return NextResponse.json({ error: "no reports yet" }, { status: 404 });
  }
  return NextResponse.json(report);
}
