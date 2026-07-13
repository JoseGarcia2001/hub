import { doublePrecision, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Último precio evaluado por activo para el cron de niveles cripto. El cron
 * compara el precio del día contra este para detectar CRUCES reales de los
 * niveles de la tesis (el nivel quedó entre ayer y hoy) — sin esto alertaría
 * todos los días mientras el precio viva más allá de un nivel. Una fila por
 * (usuario, activo); cada corrida hace upsert.
 */
export const cryptoPriceCheck = pgTable(
  "crypto_price_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Símbolo del activo vigilado: `BTC`, `ETH`. */
    asset: text("asset").notNull(),
    lastPrice: doublePrecision("last_price").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("crypto_price_check_user_asset_uq").on(t.userId, t.asset)],
);
