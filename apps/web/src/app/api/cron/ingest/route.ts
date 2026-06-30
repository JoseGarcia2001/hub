import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { investments } from "@hub/core";

/**
 * Ingesta del portafolio: la dispara el cron del server (curl con bearer secret),
 * NO el navegador. Lee del bróker headless (Flex) y persiste un snapshot en la DB.
 * Excluida del proxy de sesión (ver proxy.ts) porque se autentica con su propio secret.
 */
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false; // sin secret configurado, no se permite ingesta remota
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request): Promise<Response> {
  if (!authorized(req)) {
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
