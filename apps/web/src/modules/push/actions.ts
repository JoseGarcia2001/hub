"use server";

import { push } from "@hub/core";
import { requireSession } from "@/lib/session";

// Server Actions: siempre requireSession adentro; el dominio hace scope por userId.
// La suscripción llega como el JSON del navegador → se valida en la frontera.

export async function subscribePush(sub: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireSession();
  const parsed = push.pushSubscriptionInput.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "Suscripción inválida" };
  await push.savePushSubscription(user.id, parsed.data);
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  const { user } = await requireSession();
  await push.deletePushSubscription(user.id, endpoint);
}

export async function sendTestPush(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const { user } = await requireSession();
  try {
    const r = await push.sendToUser(user.id, {
      title: "Hub personal",
      body: "Push de prueba — si ves esto, quedó funcionando.",
      url: "/",
    });
    return { ok: true, sent: r.sent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error enviando" };
  }
}
