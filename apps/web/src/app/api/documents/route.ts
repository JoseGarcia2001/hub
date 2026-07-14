import { NextResponse } from "next/server";
import { documents, push } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Recepción de documentos genéricos por bloques (análisis y reportes de cualquier
 * tipo). Los postea un productor —agente o skill— por m2m; el hub valida la unión
 * de bloques en la frontera, persiste (upsert por slug) y notifica por push con
 * link a la página. Excluida del proxy de sesión: se autentica con su bearer.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = documents.saveDocumentInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userId } = await documents.saveOwnerDocument(parsed.data);
  let pushed = { sent: 0, failed: 0 };
  if (push.isEnabled) {
    pushed = await push.sendToUser(userId, {
      title: `📄 ${parsed.data.title}`,
      body: parsed.data.summary,
      url: `/investments/analisis/${parsed.data.slug}`,
    });
  }
  return NextResponse.json({ ok: true, slug: parsed.data.slug, pushed });
}
