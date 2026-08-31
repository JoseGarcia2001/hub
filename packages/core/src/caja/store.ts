import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@hub/db";
import { classify } from "./classify";
import type { CajaRow } from "./summary";
import type { ClassifiedTx, Flujo, Rule } from "./types";

/**
 * Dueño de la caja: hoy el hub es single-user → el primer (único) usuario.
 * ponytail: duplicado mínimo del helper de inversiones para no acoplar dominios;
 * si algún día hay varios usuarios, resolver por email explícito.
 */
export async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db.select({ id: schema.user.id }).from(schema.user).orderBy(schema.user.createdAt).limit(1);
  if (!row) throw new Error("No hay usuario provisionado; entra al hub al menos una vez antes de ingerir.");
  return row.id;
}

export async function listRules(userId: string): Promise<Rule[]> {
  const rows = await db
    .select({ keyword: schema.cajaRule.keyword, flujo: schema.cajaRule.flujo, categoria: schema.cajaRule.categoria })
    .from(schema.cajaRule)
    .where(eq(schema.cajaRule.userId, userId));
  return rows.map((r) => ({ keyword: r.keyword, flujo: r.flujo as Flujo, categoria: r.categoria }));
}

/** Inserta la transacción clasificada. Idempotente por (userId, msgId). Devuelve si fue nueva. */
export async function upsertTx(
  userId: string,
  tx: ClassifiedTx,
  msgId: string,
  rawSubject: string,
): Promise<boolean> {
  const [inserted] = await db
    .insert(schema.cajaTx)
    .values({
      userId, msgId, fuente: tx.fuente, tipo: tx.tipo, flujo: tx.flujo, categoria: tx.categoria,
      monto: tx.monto, comercio: tx.comercio || null, metodo: tx.metodo || null, ref: tx.ref || null,
      fecha: tx.fecha, hora: tx.hora || null, rawSubject: rawSubject || null,
    })
    .onConflictDoNothing({ target: [schema.cajaTx.userId, schema.cajaTx.msgId] })
    .returning({ id: schema.cajaTx.id });
  return !!inserted;
}

/**
 * Fecha de la transacción más reciente, o null si la caja está vacía.
 * La usa el sync de Gmail para abrir la ventana de búsqueda: no pregunta "¿qué hora
 * es?" sino "¿qué me falta?", así un apagón de dos semanas se cierra solo.
 */
export async function lastTxDate(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ fecha: sql<string | null>`max(${schema.cajaTx.fecha})` })
    .from(schema.cajaTx)
    .where(eq(schema.cajaTx.userId, userId));
  return row?.fecha ?? null;
}

function toRow(r: typeof schema.cajaTx.$inferSelect): CajaRow {
  return {
    id: r.id, fuente: r.fuente, tipo: r.tipo,
    flujo: (r.flujoManual ?? r.flujo) as Flujo,
    categoria: r.categoriaManual ?? r.categoria,
    monto: r.monto, comercio: r.comercio, metodo: r.metodo, ref: r.ref,
    fecha: r.fecha, hora: r.hora,
    overridden: r.flujoManual != null || r.categoriaManual != null,
  };
}

/** Todas las filas del usuario (efectivo aplicado), de la más reciente a la más vieja.
 *  El overview las agrupa por mes en memoria → el dashboard cambia de mes sin ir al server. */
export async function listAll(userId: string): Promise<CajaRow[]> {
  const rows = await db
    .select()
    .from(schema.cajaTx)
    .where(eq(schema.cajaTx.userId, userId))
    .orderBy(sql`${schema.cajaTx.fecha} desc`, sql`${schema.cajaTx.hora} desc nulls last`);
  return rows.map(toRow);
}

/** Override manual de Jose sobre una transacción (efectivo = manual ?? auto). */
export async function setClassification(userId: string, id: string, flujo: Flujo, categoria: string): Promise<void> {
  await db
    .update(schema.cajaTx)
    .set({ flujoManual: flujo, categoriaManual: categoria })
    .where(and(eq(schema.cajaTx.id, id), eq(schema.cajaTx.userId, userId)));
}

/** Enseña una regla (keyword→flujo/categoría) y reclasifica lo que ya está guardado. */
export async function addRule(userId: string, rule: Rule): Promise<void> {
  await db
    .insert(schema.cajaRule)
    .values({ userId, keyword: rule.keyword, flujo: rule.flujo, categoria: rule.categoria })
    .onConflictDoUpdate({
      target: [schema.cajaRule.userId, schema.cajaRule.keyword],
      set: { flujo: rule.flujo, categoria: rule.categoria },
    });
}

/**
 * Reclasifica la clasificación AUTO de todo el store (respeta los override manuales,
 * que siguen mandando en el efectivo). Se llama tras aprender una regla o afinar
 * las tablas fijas. Devuelve cuántas filas cambiaron.
 */
export async function reclassifyAll(userId: string): Promise<number> {
  const rules = await listRules(userId);
  const all = await db.select().from(schema.cajaTx).where(eq(schema.cajaTx.userId, userId));
  let changed = 0;
  for (const r of all) {
    const c = classify(
      {
        fuente: r.fuente as ClassifiedTx["fuente"], tipo: r.tipo, monto: r.monto,
        comercio: r.comercio || "", metodo: r.metodo || "", ref: r.ref || "", fecha: r.fecha, hora: r.hora || "",
      },
      rules,
    );
    if (c.flujo !== r.flujo || c.categoria !== r.categoria) {
      await db.update(schema.cajaTx).set({ flujo: c.flujo, categoria: c.categoria }).where(eq(schema.cajaTx.id, r.id));
      changed++;
    }
  }
  return changed;
}
