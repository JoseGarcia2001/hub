import { NextResponse } from "next/server";
import { cryptoWatch } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Vigilancia de niveles de la tesis cripto: la dispara el cron del server
 * (diario). Precio spot vs niveles → push SOLO en cruce real desde la corrida
 * anterior. Determinista: aquí no hay análisis; la alerta convoca una sesión.
 */
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await cryptoWatch.check();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

export const POST = run;
export const GET = run; // permite un curl simple desde cron
