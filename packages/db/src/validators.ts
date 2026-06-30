import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pendiente } from "./schema";

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
