import { NextResponse } from "next/server";
import { z } from "zod";
import { documents, push } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Alertas de Termix (salud del servidor: host caído, disco, contenedor muerto).
 * Termix las manda como webhook con un cuerpo fijo; aquí se traducen a un
 * documento de alerta, que es lo que dispara el push. Un slug por regla: la
 * alerta se sobrescribe en vez de acumular una entrada por disparo.
 */
export const dynamic = "force-dynamic";

const termixAlert = z.object({
  title: z.string().min(1),
  message: z.string().default(""),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  hostName: z.string().nullish(),
  ruleName: z.string().nullish(),
  triggerType: z.string().nullish(),
  value: z.union([z.number(), z.string()]).nullish(),
  threshold: z.union([z.number(), z.string()]).nullish(),
  timestamp: z.coerce.date().default(() => new Date()),
});

const ICONO = { info: "ℹ️", warning: "⚠️", critical: "🔴" } as const;
const TONO = { info: "brass", warning: "neg", critical: "neg" } as const;

/** Un slug por regla para que la alerta se sobrescriba. */
function slugDe(titulo: string): string {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `alerta-servidor-${base || "sin-titulo"}`;
}

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
  const parsed = termixAlert.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const a = parsed.data;
  const icono = ICONO[a.severity];
  const titulo = `${icono} ${a.title}`;
  const detalle = [
    a.hostName ? `Host: ${a.hostName}` : null,
    a.value != null && a.threshold != null ? `Valor: ${a.value} (umbral ${a.threshold})` : null,
    a.triggerType ? `Disparador: ${a.triggerType}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const { userId } = await documents.saveOwnerDocument({
    slug: slugDe(a.ruleName || a.title),
    kind: "alerta",
    title: titulo,
    summary: a.message || a.title,
    generatedAt: a.timestamp,
    sourceUrl: null,
    payload: {
      blocks: [
        { kind: "callout", tone: TONO[a.severity], title: titulo, text: a.message || a.title },
        ...(detalle ? [{ kind: "prose" as const, text: detalle }] : []),
      ],
    },
  });

  let pushed = { sent: 0, failed: 0 };
  if (push.isEnabled) {
    pushed = await push.sendToUser(userId, {
      title: titulo,
      body: a.message || detalle || a.title,
      url: "/",
    });
  }
  return NextResponse.json({ ok: true, pushed });
}
