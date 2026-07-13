import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  cajaRule, cajaTx, investmentReport, obligacion, obligacionInstancia, pendiente, portfolioSnapshot,
} from "./schema";

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

/** Caja: transacción y regla de clasificación aprendida (drizzle-zod = SSOT). */
export const insertCajaTx = createInsertSchema(cajaTx);
export const selectCajaTx = createSelectSchema(cajaTx);
export const insertCajaRule = createInsertSchema(cajaRule, {
  keyword: (s) => s.trim().toLowerCase().min(2, "Keyword muy corto").max(60),
  categoria: (s) => s.trim().min(1).max(60),
});
export const selectCajaRule = createSelectSchema(cajaRule);

/** Obligaciones: registro recurrente + instancia por período (drizzle-zod = SSOT). */
export const insertObligacion = createInsertSchema(obligacion, {
  proveedorKey: (s) => s.trim().toLowerCase().min(2).max(40),
  nombre: (s) => s.trim().min(1).max(80),
});
export const selectObligacion = createSelectSchema(obligacion);
export const insertObligacionInstancia = createInsertSchema(obligacionInstancia);
export const selectObligacionInstancia = createSelectSchema(obligacionInstancia);

/**
 * Informe semanal de inversiones: el `payload` estructurado que postea el agente
 * asesor. Se valida completo en la frontera m2m (`POST /api/reports`) — datos
 * externos no entran sin pasar por aquí.
 */
export const reportLevelSchema = z.object({
  level: z.number(),
  label: z.string().min(1),
  distancePct: z.number(),
  crossedThisWeek: z.boolean().optional(),
});

export const reportPayloadSchema = z.object({
  tldr: z.array(z.string().min(1)).min(1).max(8),
  portfolio: z.object({
    nav: z.number(),
    cash: z.number(),
    positionsValue: z.number(),
    unrealizedPnl: z.number(),
    unrealizedPnlPct: z.number(),
    weekDelta: z.object({ nav: z.number(), navPct: z.number() }).nullable(),
    topMovers: z.array(z.object({ symbol: z.string(), weekPct: z.number() })),
    concentration: z.object({ top3Pct: z.number(), flags: z.array(z.string()) }),
  }),
  crypto: z
    .object({
      assets: z.array(
        z.object({ symbol: z.string(), price: z.number(), levels: z.array(reportLevelSchema) }),
      ),
      windowNote: z.string(),
    })
    .nullable(),
  companies: z.array(
    z.object({
      symbol: z.string(),
      headline: z.string().min(1),
      source: z.string().min(1),
      why: z.string().min(1),
      thesisImpact: z.string().min(1),
    }),
  ),
  noNews: z.array(z.string()),
  recommendations: z.array(
    z.object({
      action: z.enum(["MANTENER", "VIGILAR", "ANALIZAR", "CONSIDERAR_VENTA", "CONSIDERAR_COMPRA"]),
      symbol: z.string(),
      rationale: z.string().min(1),
      wouldChangeIf: z.string().min(1),
    }),
  ),
  agenda: z.array(z.object({ date: z.string(), symbol: z.string(), event: z.string() })),
});

export const insertInvestmentReport = createInsertSchema(investmentReport, {
  week: (s) => s.regex(/^\d{4}-W\d{2}$/, "Semana ISO esperada: YYYY-Wnn"),
  payload: () => reportPayloadSchema,
});
export const selectInvestmentReport = createSelectSchema(investmentReport, {
  payload: () => reportPayloadSchema,
});
