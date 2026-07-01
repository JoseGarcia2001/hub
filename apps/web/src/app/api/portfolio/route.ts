import { NextResponse } from "next/server";
import { investments } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Lectura del último snapshot del portafolio (JSON), para consumidores máquina
 * (p.ej. el agente asesor de inversiones). SSOT = la DB del hub; no toca el bróker.
 * Protegido con bearer (INGEST_SECRET), fuera del proxy de sesión.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const snap = await investments.getOwnerSnapshot();
  if (!snap) {
    return NextResponse.json({ error: "no snapshot yet" }, { status: 404 });
  }
  return NextResponse.json(snap);
}
