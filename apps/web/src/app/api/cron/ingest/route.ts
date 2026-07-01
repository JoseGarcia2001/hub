import { NextResponse } from "next/server";
import { investments } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Ingesta del portafolio: la dispara el cron del server (curl con bearer secret),
 * NO el navegador. Lee del bróker headless (Flex) y persiste un snapshot en la DB.
 * Excluida del proxy de sesión (ver proxy.ts) porque se autentica con su propio secret.
 */
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await investments.ingest();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof investments.InvestmentsSourceError ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

export const POST = run;
export const GET = run; // permite un curl simple desde cron
