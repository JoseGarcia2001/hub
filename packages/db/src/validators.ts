import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { pendiente, portfolioSnapshot } from "./schema";

/**
 * Validadores Zod derivados del esquema Drizzle (única fuente de verdad).
 * Convención del hub: cada tabla de dominio expone aquí su `insert*`/`select*`.
 * En el refinamiento (2º arg) se ajustan reglas que la DB no expresa (ej. largo mínimo).
 * Los inputs de cada operación (lo que llena el usuario) se derivan de estos en
 * `@hub/core` con `.pick()/.omit()`, sin duplicar tipos.
 */
export const insertPendiente = createInsertSchema(pendiente, {
  titulo: (s) => s.trim().min(1, "El título es obligatorio").max(200),
  detalle: (s) => s.trim().max(2000),
});

export const selectPendiente = createSelectSchema(pendiente);

/** Forma de cada posición dentro del `jsonb` del snapshot (moneda base = USD). */
export const positionSchema = z.object({
  conid: z.number(),
  symbol: z.string(),
  name: z.string().optional(),
  quantity: z.number(),
  currency: z.string(),
  avgCost: z.number(),
  marketPrice: z.number(),
  marketValueBase: z.number(),
  unrealizedPnlBase: z.number(),
  costBasisBase: z.number(),
  weightPct: z.number(),
});

export const insertPortfolioSnapshot = createInsertSchema(portfolioSnapshot, {
  positions: () => z.array(positionSchema),
});
export const selectPortfolioSnapshot = createSelectSchema(portfolioSnapshot, {
  positions: () => z.array(positionSchema),
});
