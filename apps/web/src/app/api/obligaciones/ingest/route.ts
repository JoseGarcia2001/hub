import { NextResponse } from "next/server";
import { obligaciones } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Ingesta de facturas de servicios (M2M, bearer). La alimenta el Worker relay
 * (correo de factura reenviado) y el seed vía gwsp. Acepta un correo o `{emails:[]}`.
 * Excluida del proxy de sesión (ver proxy.ts).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!bearerOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  const emails = (body as { emails?: obligaciones.EmailInput[] }).emails;
  if (Array.isArray(emails)) {
    const results = [];
    for (const e of emails) results.push(await obligaciones.ingestFactura(e));
    return NextResponse.json({ ok: true, procesados: results.length, ingeridos: results.filter((r) => r.ok).length, results });
  }
  const r = await obligaciones.ingestFactura(body as obligaciones.EmailInput);
  return NextResponse.json(r);
}
