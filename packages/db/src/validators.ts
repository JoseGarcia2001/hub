import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  cajaRule, cajaTx, document, obligacion, obligacionInstancia, pendiente, portfolioSnapshot,
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
 * Documento genérico por bloques. La unión discriminada se valida COMPLETA en la
 * frontera m2m (`POST /api/documents`): un bloque mal formado no entra a la DB.
 */
const blockToneSchema = z.enum(["pos", "neg", "brass"]);

const docBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heading"), text: z.string().min(1), level: z.union([z.literal(2), z.literal(3)]).optional() }),
  z.object({ kind: z.literal("prose"), text: z.string().min(1) }),
  z.object({ kind: z.literal("list"), items: z.array(z.string().min(1)).min(1), ordered: z.boolean().optional() }),
  z.object({
    kind: z.literal("stat-grid"),
    items: z
      .array(z.object({ label: z.string().min(1), value: z.string().min(1), sub: z.string().optional(), tone: blockToneSchema.optional() }))
      .min(1),
  }),
  z.object({
    kind: z.literal("bar-chart"),
    title: z.string().optional(),
    note: z.string().optional(),
    diverging: z.boolean().optional(),
    items: z
      .array(z.object({ label: z.string().min(1), value: z.number(), sub: z.string().optional(), tone: blockToneSchema.optional() }))
      .min(1),
  }),
  z.object({
    kind: z.literal("table"),
    title: z.string().optional(),
    note: z.string().optional(),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  z.object({ kind: z.literal("callout"), tone: blockToneSchema.optional(), title: z.string().optional(), text: z.string().min(1) }),
]);

export const documentPayloadSchema = z.object({ blocks: z.array(docBlockSchema).min(1) });

export const insertDocument = createInsertSchema(document, {
  slug: (s) => s.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug kebab-case esperado"),
  kind: (s) => s.trim().min(1).max(40),
  title: (s) => s.trim().min(1).max(160),
  summary: (s) => s.trim().min(1).max(280),
  payload: () => documentPayloadSchema,
});
export const selectDocument = createSelectSchema(document, {
  payload: () => documentPayloadSchema,
});
