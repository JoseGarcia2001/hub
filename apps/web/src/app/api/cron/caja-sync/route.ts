import { NextResponse } from "next/server";
import { caja } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Sync de caja contra Gmail: la dispara el cron del server (curl con bearer secret).
 * Va y pregunta "¿qué me falta?" en vez de esperar a que le empujen: por eso cierra
 * solo los huecos que deja el Worker de Cloudflare cuando el server está apagado.
 * Excluida del proxy de sesión (ver proxy.ts) porque se autentica con su propio secret.
 */
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!caja.gmailConfigured()) {
    return NextResponse.json(
      { ok: false, error: "gmail no configurado (faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)" },
      { status: 503 },
    );
  }
  try {
    return NextResponse.json({ ok: true, ...(await caja.syncFromGmail()) });
  } catch (e) {
    // 401 y no 502 cuando el problema es la credencial: el reconciliador distingue
    // "Gmail me rechazó" (hay que regenerar el token) de "Gmail falló" (reintentar).
    const auth = e instanceof caja.GmailAuthError;
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: auth ? 401 : 502 });
  }
}

export const POST = run;
export const GET = run; // permite un curl simple desde cron
