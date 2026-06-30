import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Tabla de ejemplo del dominio "pendientes" — plantilla para nuevos dominios.
 * Toda tabla de dominio:
 *  - lleva `userId` con FK a `user` (scope por usuario; hoy single-user, pero correcto),
 *  - usa `timestamp({ withTimezone: true })` para fechas,
 *  - tiene PK uuid generada en la DB (`gen_random_uuid()`, nativo en PG ≥13).
 */
export const pendiente = pgTable("pendiente", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  detalle: text("detalle"),
  vence: timestamp("vence", { withTimezone: true }),
  hecho: boolean("hecho").notNull().default(false),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});
