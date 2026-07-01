import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Suscripción Web Push — una por dispositivo/navegador del usuario.
 * El `endpoint` es único: si el mismo navegador se re-suscribe, se hace upsert
 * sobre esa fila (no se duplica). `p256dh`/`auth` son las claves de cifrado que
 * el navegador entrega al suscribirse; el server las usa para firmar el envío.
 */
export const pushSubscription = pgTable("push_subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});
