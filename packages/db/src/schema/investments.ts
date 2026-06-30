import { doublePrecision, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Una posición del portafolio, ya normalizada a moneda base (USD).
 * Es el contenido del `jsonb` de cada snapshot y la forma que consume la UI.
 * Vive aquí (capa más baja) para no duplicarla: `@hub/core` y `apps/web` la
 * importan desde acá. Los `*Base` ya vienen convertidos a USD por el adapter.
 */
export type Position = {
  conid: number;
  symbol: string;
  name?: string;
  quantity: number;
  /** Moneda nativa de la posición (p.ej. HKD para papeles de Hong Kong). */
  currency: string;
  /** Costo promedio por acción, en moneda nativa. */
  avgCost: number;
  /** Precio de mercado, en moneda nativa. */
  marketPrice: number;
  /** Valor de mercado convertido a USD. */
  marketValueBase: number;
  /** P&L no realizado convertido a USD. */
  unrealizedPnlBase: number;
  /** Costo base en USD = marketValueBase - unrealizedPnlBase. */
  costBasisBase: number;
  /** Peso sobre el valor total de posiciones. */
  weightPct: number;
};

/**
 * Snapshot del portafolio IBKR. La ingesta (headless, cron) escribe filas aquí
 * y la página LEE de aquí — nunca del bróker en vivo. Así la disponibilidad de
 * la vista no depende de que el gateway/Mac esté arriba; la frescura degrada con
 * gracia (se muestra `asOf`). Posiciones en `jsonb`: se leen y escriben enteras,
 * no se consultan por posición. (Si algún día se necesitan series por posición,
 * se normaliza a su propia tabla.)
 *
 * Montos como `doublePrecision` (number en JS, sin coerción string): son cifras
 * de display ya redondeadas por IBKR. ponytail: si se necesita exactitud contable
 * exacta, migrar a numeric.
 */
export const portfolioSnapshot = pgTable(
  "portfolio_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    baseCurrency: text("base_currency").notNull().default("USD"),
    netLiquidation: doublePrecision("net_liquidation").notNull(),
    cash: doublePrecision("cash").notNull(),
    positionsValue: doublePrecision("positions_value").notNull(),
    unrealizedPnl: doublePrecision("unrealized_pnl").notNull(),
    unrealizedPnlPct: doublePrecision("unrealized_pnl_pct").notNull(),
    positions: jsonb("positions").$type<Position[]>().notNull(),
    /** Fuente que produjo el snapshot: 'flex' (headless) o 'cp-rest' (gateway). */
    source: text("source").notNull(),
    /** Momento de los datos según el bróker. */
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  // Índice para "último snapshot del usuario" (ORDER BY as_of DESC LIMIT 1).
  (t) => [index("portfolio_snapshot_user_asof_idx").on(t.userId, t.asOf)],
);
