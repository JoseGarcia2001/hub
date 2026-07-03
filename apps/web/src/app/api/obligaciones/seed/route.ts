import { NextResponse } from "next/server";
import { obligaciones } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Siembra idempotente del catálogo de obligaciones (M2M, bearer). Se corre una vez
 * tras desplegar (y cuando cambie el catálogo). Excluida del proxy de sesión.
 */
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!bearerOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const userId = await obligaciones.resolveOwnerUserId();
  const r = await obligaciones.sembrar(userId);
  return NextResponse.json({ ok: true, ...r });
}

export const GET = run;
export const POST = run;
