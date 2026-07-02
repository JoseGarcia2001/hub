import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import webpush from "web-push";
import { db, schema } from "@hub/db";

/**
 * Dominio "push" — Web Push (notificaciones al celular). Server-only.
 *
 * VAPID: par de claves que identifica a este servidor ante el push service del
 * navegador. La pública viaja al cliente (no es secreto) y se hornea en la
 * suscripción; la privada firma cada envío y es SECRETA (vive en env, nunca en
 * el repo). Sin claves, el push queda apagado: `isEnabled` es false y `sendToUser`
 * lanza error solo si de verdad se intenta enviar.
 */
const env = z
  .object({
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional().default("mailto:push@jogadev.com"),
  })
  .parse(process.env);

/** Clave pública VAPID (no secreta): el server la pasa al componente cliente. */
export const publicKey = env.VAPID_PUBLIC_KEY;
/** Si el push está configurado (ambas claves presentes). */
export const isEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error("Push no configurado: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

/** Forma de la suscripción tal como la entrega el navegador (`PushSubscription.toJSON()`). */
export const pushSubscriptionInput = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInput>;

export async function savePushSubscription(
  userId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  await db
    .insert(schema.pushSubscription)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    // Mismo navegador re-suscrito → refresca sus claves en vez de duplicar.
    .onConflictDoUpdate({
      target: schema.pushSubscription.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(schema.pushSubscription)
    .where(
      and(
        eq(schema.pushSubscription.endpoint, endpoint),
        eq(schema.pushSubscription.userId, userId),
      ),
    );
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Envía a todas las suscripciones del usuario. Purga las muertas (404/410) para
 * que la tabla no acumule endpoints caducados.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  ensureConfigured();
  const subs = await db
    .select()
    .from(schema.pushSubscription)
    .where(eq(schema.pushSubscription.userId, userId));

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db
            .delete(schema.pushSubscription)
            .where(eq(schema.pushSubscription.id, s.id));
        }
      }
    }),
  );
  return { sent, failed };
}
