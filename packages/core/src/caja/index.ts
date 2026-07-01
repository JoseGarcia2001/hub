import "server-only";
import { parse } from "./parse";
import { classify } from "./classify";
import { summarize, type CajaRow, type CajaSummary } from "./summary";
import {
  addRule, availableMonths, listByMonth, listRules, reclassifyAll,
  resolveOwnerUserId, setClassification, upsertTx,
} from "./store";
import type { ClassifiedTx, EmailInput, Flujo, Rule } from "./types";

/**
 * API pública del dominio "Caja". La ingesta (Worker en vivo + backfill) entra por
 * `ingest`/`ingestBatch`; el dashboard lee por `monthlyView`; Jose corrige/enseña
 * por `setClassification`/`remember`. Parser y clasificador son únicos (server-side).
 */

export type { CajaRow, CajaSummary, EmailInput, Flujo, Rule };
export { resolveOwnerUserId };

/** msg_id de idempotencia: Message-ID del correo, o huella estable si no viniera. */
function dedupeKey(email: EmailInput, tx: ClassifiedTx): string {
  return email.messageId || `${tx.fuente}:${tx.fecha}:${tx.monto}:${tx.ref}`;
}

export type IngestResult =
  | { ok: true; created: boolean; tx: ClassifiedTx }
  | { ok: false; reason: string };

/** Un correo → transacción persistida. Idempotente. Lo llama el Worker (M2M). */
export async function ingest(email: EmailInput): Promise<IngestResult> {
  const parsed = parse(email);
  if (!parsed) return { ok: false, reason: "no_parse" };
  const userId = await resolveOwnerUserId();
  const rules = await listRules(userId);
  const tx = classify(parsed, rules);
  const created = await upsertTx(userId, tx, dedupeKey(email, tx), email.subject || "");
  return { ok: true, created, tx };
}

/** Lote de correos (backfill): resuelve dueño+reglas una vez. Idempotente. */
export async function ingestBatch(emails: EmailInput[]): Promise<{ created: number; duplicated: number; skipped: number }> {
  const userId = await resolveOwnerUserId();
  const rules = await listRules(userId);
  let created = 0, duplicated = 0, skipped = 0;
  for (const email of emails) {
    const parsed = parse(email);
    if (!parsed) { skipped++; continue; }
    const tx = classify(parsed, rules);
    if (await upsertTx(userId, tx, dedupeKey(email, tx), email.subject || "")) created++;
    else duplicated++;
  }
  return { created, duplicated, skipped };
}

export type MonthlyView = {
  mes: string;
  meses: string[];
  summary: CajaSummary;
  rows: CajaRow[];
  porClasificar: CajaRow[];
  sinCategoria: string[];
};

/** Todo lo que necesita el dashboard para un mes (por defecto, el más reciente con datos). */
export async function monthlyView(userId: string, mes?: string): Promise<MonthlyView> {
  const meses = await availableMonths(userId);
  const activo = mes && meses.includes(mes) ? mes : meses[0] ?? "";
  const rows = activo ? await listByMonth(userId, activo) : [];
  const porClasificar = rows.filter((r) => r.flujo === "por_clasificar");
  const sinCategoria = [...new Set(rows.filter((r) => r.categoria === "Sin categorizar").map((r) => r.comercio || "—"))];
  return { mes: activo, meses, summary: summarize(rows), rows, porClasificar, sinCategoria };
}

/** Corrige la clasificación de una transacción (override manual). */
export async function reclasificar(userId: string, id: string, flujo: Flujo, categoria: string): Promise<void> {
  await setClassification(userId, id, flujo, categoria);
}

/** Enseña una regla (keyword→flujo/categoría) y reclasifica el store completo. */
export async function remember(userId: string, rule: Rule): Promise<number> {
  await addRule(userId, rule);
  return reclassifyAll(userId);
}

/** Reclasifica todo (tras afinar reglas fijas). Devuelve cuántas filas cambiaron. */
export async function reclassify(userId: string): Promise<number> {
  return reclassifyAll(userId);
}
