import { NextResponse } from "next/server";
import { documents } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Último documento del dueño (m2m), opcionalmente por `?kind=`. Da continuidad al
 * productor: leer el análisis anterior antes de generar el siguiente. 404 si no hay.
 * Excluida del proxy de sesión (prefijo `api/documents`): bearer propio.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const kind = new URL(req.url).searchParams.get("kind") ?? undefined;
  const doc = await documents.getOwnerLatest(kind);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, document: doc });
}
