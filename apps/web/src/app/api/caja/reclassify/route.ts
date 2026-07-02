import { NextResponse } from "next/server";
import { caja } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Reclasifica todo el histórico (M2M, bearer). Se llama tras afinar las reglas
 * fijas del clasificador (REGLAS/CONTRAPARTES) para que el pasado se recategorice.
 * Respeta los override manuales de Jose. Idempotente.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!bearerOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = await caja.resolveOwnerUserId();
  const changed = await caja.reclassify(userId);
  return NextResponse.json({ ok: true, changed });
}
