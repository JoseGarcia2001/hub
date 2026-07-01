import { NextResponse } from "next/server";
import { z } from "zod";
import { caja } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Ingesta de transacciones (M2M, bearer = INGEST_SECRET). SSOT = la DB del hub.
 * Un correo (el Worker de Cloudflare en vivo) o un lote (el backfill histórico);
 * el hub parsea + clasifica + upsert idempotente. Fuera del proxy de sesión.
 */
export const dynamic = "force-dynamic";

const emailSchema = z.object({
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  messageId: z.string().nullish(),
});
const batchSchema = z.object({ emails: z.array(emailSchema).min(1).max(2000) });

export async function POST(req: Request) {
  if (!bearerOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const batch = batchSchema.safeParse(json);
  if (batch.success) {
    const res = await caja.ingestBatch(batch.data.emails);
    return NextResponse.json({ ok: true, ...res });
  }

  const one = emailSchema.safeParse(json);
  if (!one.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  return NextResponse.json(await caja.ingest(one.data));
}
