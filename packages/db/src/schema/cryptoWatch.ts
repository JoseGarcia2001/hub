import { doublePrecision, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Último precio evaluado por activo. El cron compara contra este para alertar solo en
 * un CRUCE (el nivel quedó entre la corrida anterior y esta), no cada día que el precio
 * siga más allá del nivel. Una fila por (usuario, activo).
 */
export const cryptoPriceCheck = pgTable(
  "crypto_price_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Símbolo del activo vigilado, p. ej. `BTC`. */
    asset: text("asset").notNull(),
    lastPrice: doublePrecision("last_price").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("crypto_price_check_user_asset_uq").on(t.userId, t.asset)],
);
