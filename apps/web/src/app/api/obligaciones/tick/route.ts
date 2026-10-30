import { NextResponse } from "next/server";
import { hoyBogota, obligaciones, resolveOwnerUserId } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Tick diario (M2M, bearer): trae las facturas nuevas de Gmail, reconcilia (casa pagos
 * de Caja) y envía los push que toquen (diario desde 3 días antes, solo impagas). Lo
 * dispara el crontab del server. Excluido del proxy de sesión.
 * Si Gmail falla, el tick corre igual con lo que ya hay: el error va en `facturas`.
 */
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!bearerOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const userId = await resolveOwnerUserId();
  const today = hoyBogota();
  let facturas: obligaciones.SyncFacturasResult | { error: string } | null = null;
  if (obligaciones.gmailConfigured()) {
    try {
      facturas = await obligaciones.syncFacturasFromGmail(today);
    } catch (e) {
      facturas = { error: String(e instanceof Error ? e.message : e) };
    }
  }
  const r = await obligaciones.tick(userId, today);
  return NextResponse.json({ ok: true, today, facturas, ...r });
}

export const GET = run;
export const POST = run;
