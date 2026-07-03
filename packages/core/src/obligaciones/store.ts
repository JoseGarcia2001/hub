import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@hub/db";
import type { CajaLite } from "./match";
import type { Estado, ParsedFactura } from "./types";

/**
 * ponytail: mismo helper de dueño que caja/investments (single-user → primer usuario).
 * Si algún día hay varios usuarios, resolver por email explícito.
 */
export async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db.select({ id: schema.user.id }).from(schema.user).orderBy(schema.user.createdAt).limit(1);
  if (!row) throw new Error("No hay usuario provisionado; entra al hub al menos una vez.");
  return row.id;
}

export type Obligacion = typeof schema.obligacion.$inferSelect;
export type Instancia = typeof schema.obligacionInstancia.$inferSelect;

export async function listObligaciones(userId: string): Promise<Obligacion[]> {
  return db.select().from(schema.obligacion).where(eq(schema.obligacion.userId, userId)).orderBy(asc(schema.obligacion.nombre));
}

/** Siembra/actualiza una obligación (idempotente por proveedorKey). Devuelve su id. */
export async function upsertObligacion(
  userId: string,
  o: Omit<typeof schema.obligacion.$inferInsert, "userId" | "id" | "creadoEn">,
): Promise<string> {
  const [row] = await db
    .insert(schema.obligacion)
    .values({ ...o, userId })
    .onConflictDoUpdate({
      target: [schema.obligacion.userId, schema.obligacion.proveedorKey],
      set: {
        nombre: o.nombre, proveedor: o.proveedor, categoria: o.categoria, cadencia: o.cadencia,
        cuentaContrato: o.cuentaContrato, fuenteVencimiento: o.fuenteVencimiento,
        matchStrategy: o.matchStrategy, matchKeywords: o.matchKeywords,
        montoEsperado: o.montoEsperado, diaVencimiento: o.diaVencimiento,
        mesVencimiento: o.mesVencimiento, activa: o.activa,
      },
    })
    .returning({ id: schema.obligacion.id });
  return row.id;
}

export async function getObligacionByKey(userId: string, proveedorKey: string): Promise<Obligacion | null> {
  const [row] = await db
    .select()
    .from(schema.obligacion)
    .where(and(eq(schema.obligacion.userId, userId), eq(schema.obligacion.proveedorKey, proveedorKey)));
  return row ?? null;
}

/** Crea/actualiza la instancia de un período desde una factura (idempotente por período). */
export async function upsertInstanciaFactura(
  userId: string,
  obligacionId: string,
  f: ParsedFactura,
  facturaMsgId: string | null,
): Promise<void> {
  await db
    .insert(schema.obligacionInstancia)
    .values({
      userId, obligacionId, periodo: f.periodo, montoEsperado: f.monto,
      fechaEmision: f.fechaEmision, fechaVencimiento: f.fechaVencimiento, facturaMsgId,
    })
    .onConflictDoUpdate({
      target: [schema.obligacionInstancia.obligacionId, schema.obligacionInstancia.periodo],
      // No pisar un pago ya confirmado; sí refrescar monto/vencimiento si la factura corrige.
      set: { montoEsperado: f.monto, fechaEmision: f.fechaEmision, fechaVencimiento: f.fechaVencimiento, facturaMsgId },
    });
}

/** Crea la instancia de un período si no existe (obligaciones fijas / sembradas). No pisa. */
export async function ensureInstancia(
  userId: string,
  obligacionId: string,
  periodo: string,
  fechaVencimiento: string,
  montoEsperado: number,
): Promise<void> {
  await db
    .insert(schema.obligacionInstancia)
    .values({ userId, obligacionId, periodo, fechaVencimiento, montoEsperado })
    .onConflictDoNothing({ target: [schema.obligacionInstancia.obligacionId, schema.obligacionInstancia.periodo] });
}

export async function listInstancias(userId: string): Promise<Instancia[]> {
  return db.select().from(schema.obligacionInstancia).where(eq(schema.obligacionInstancia.userId, userId));
}

/** Tx de Caja del usuario desde `desde` (YYYY-MM-DD) para correlacionar. */
export async function cajaRowsDesde(userId: string, desde: string): Promise<CajaLite[]> {
  const rows = await db
    .select({ id: schema.cajaTx.id, monto: schema.cajaTx.monto, comercio: schema.cajaTx.comercio, fecha: schema.cajaTx.fecha })
    .from(schema.cajaTx)
    .where(and(eq(schema.cajaTx.userId, userId), gte(schema.cajaTx.fecha, desde)));
  return rows;
}

export async function setPagada(userId: string, id: string, cajaTxId: string | null, manual: boolean): Promise<void> {
  await db
    .update(schema.obligacionInstancia)
    .set({ estado: "pagado", cajaTxId, pagadoManual: manual })
    .where(and(eq(schema.obligacionInstancia.id, id), eq(schema.obligacionInstancia.userId, userId)));
}

export async function setEstado(userId: string, id: string, estado: Estado): Promise<void> {
  await db
    .update(schema.obligacionInstancia)
    .set({ estado })
    .where(and(eq(schema.obligacionInstancia.id, id), eq(schema.obligacionInstancia.userId, userId)));
}

export async function setNotificado(userId: string, id: string, fecha: string): Promise<void> {
  await db
    .update(schema.obligacionInstancia)
    .set({ notificadoEn: fecha })
    .where(and(eq(schema.obligacionInstancia.id, id), eq(schema.obligacionInstancia.userId, userId)));
}

/** Override manual: marcar pagada (fuera de Caja) o revertir a pendiente para que reconcile reintente. */
export async function marcarPagadoManual(userId: string, id: string, pagado: boolean): Promise<void> {
  await db
    .update(schema.obligacionInstancia)
    .set(pagado ? { estado: "pagado", pagadoManual: true } : { estado: "pendiente", pagadoManual: false, cajaTxId: null })
    .where(and(eq(schema.obligacionInstancia.id, id), eq(schema.obligacionInstancia.userId, userId)));
}
