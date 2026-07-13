import { NextResponse } from "next/server";
import { push, reports } from "@hub/core";
import { bearerOk } from "@/lib/apiAuth";

/**
 * Recepción del informe semanal de inversiones. Lo postea el agente asesor
 * (skill `informe-portafolio` en ~/Personal) por m2m; el hub valida en la
 * frontera, persiste (upsert por semana) y notifica por push con link a la
 * página. Excluida del proxy de sesión: se autentica con su propio bearer.
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
  const parsed = reports.saveReportInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userId } = await reports.saveOwnerReport(parsed.data);
  let pushed = { sent: 0, failed: 0 };
  if (push.isEnabled) {
    pushed = await push.sendToUser(userId, {
      title: `📊 Informe de inversiones ${parsed.data.week}`,
      body: parsed.data.payload.tldr[0] ?? "Informe semanal disponible.",
      url: "/investments/reports",
    });
  }
  return NextResponse.json({ ok: true, week: parsed.data.week, pushed });
}
