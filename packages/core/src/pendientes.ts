import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema, validators } from "@hub/db";
import { z } from "zod";

/**
 * Dominio "pendientes" — plantilla de un módulo de dominio.
 *
 * Aquí vive la lógica reutilizable y server-only: tipos, contrato de input y
 * acceso a datos. NO conoce de React ni de Next; la UI/route lo consume desde
 * `apps/web`. Toda consulta va con scope por `userId` (defensa: nadie toca filas
 * de otro), aunque hoy el hub sea de un solo usuario.
 */

/** Tipo de fila, inferido del esquema Drizzle (sin duplicar a mano). */
export type Pendiente = typeof schema.pendiente.$inferSelect;

/**
 * Contrato de creación: derivado del validador de la tabla (drizzle-zod), nos
 * quedamos con lo que llena el usuario. `vence` llega como string del form → coerce.
 */
export const crearPendienteInput = validators.insertPendiente
  .pick({ titulo: true, detalle: true })
  .extend({ vence: z.coerce.date().optional() });

export type CrearPendienteInput = z.infer<typeof crearPendienteInput>;

export function listarPendientes(userId: string): Promise<Pendiente[]> {
  return db
    .select()
    .from(schema.pendiente)
    .where(eq(schema.pendiente.userId, userId))
    .orderBy(schema.pendiente.hecho, desc(schema.pendiente.creadoEn));
}

export async function crearPendiente(userId: string, input: CrearPendienteInput): Promise<void> {
  await db.insert(schema.pendiente).values({ ...input, userId });
}

export async function alternarPendiente(userId: string, id: string): Promise<void> {
  const scope = and(eq(schema.pendiente.id, id), eq(schema.pendiente.userId, userId));
  const [row] = await db
    .select({ hecho: schema.pendiente.hecho })
    .from(schema.pendiente)
    .where(scope);
  if (!row) return;
  await db.update(schema.pendiente).set({ hecho: !row.hecho }).where(scope);
}

export async function eliminarPendiente(userId: string, id: string): Promise<void> {
  await db
    .delete(schema.pendiente)
    .where(and(eq(schema.pendiente.id, id), eq(schema.pendiente.userId, userId)));
}
