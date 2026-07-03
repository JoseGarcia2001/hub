import { NextResponse } from "next/server";
import { obligaciones } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Tick diario (M2M, bearer): reconcilia (casa pagos de Caja) y envía los push que
 * toquen (3 días antes / el día / diario si venció, solo impagas). Lo dispara el
 * crontab del server. Excluido del proxy de sesión.
 */
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!bearerOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const userId = await obligaciones.resolveOwnerUserId();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const r = await obligaciones.tick(userId, today);
  return NextResponse.json({ ok: true, today, ...r });
}

export const GET = run;
export const POST = run;
