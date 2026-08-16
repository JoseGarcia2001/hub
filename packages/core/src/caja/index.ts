import "server-only";
import { parse } from "./parse";
import { classify } from "./classify";
import { summarize, type CajaRow, type CajaSummary } from "./summary";
import {
  addRule, listAll, listRules, reclassifyAll,
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

/** Datos de un mes: KPIs + movimientos. La UI deriva lo que pide atención de `rows`. */
export type MonthData = {
  mes: string;
  summary: CajaSummary;
  rows: CajaRow[];
};

/** Un punto de la serie de tendencia (un mes). */
export type TrendPoint = { mes: string; ingreso: number; egreso: number; neto: number; consumo: number };

/** Todo el historial, precomputado y agrupado por mes + la serie de tendencia.
 *  Se manda entero al dashboard (una sola vez) → cambiar de mes es instantáneo, sin server. */
export type Overview = { meses: string[]; trend: TrendPoint[]; months: Record<string, MonthData> };

export async function overview(userId: string): Promise<Overview> {
  const all = await listAll(userId); // ya viene fecha desc
  const byMes = new Map<string, CajaRow[]>();
  for (const r of all) {
    const m = r.fecha.slice(0, 7);
    const arr = byMes.get(m);
    if (arr) arr.push(r);
    else byMes.set(m, [r]);
  }
  const asc = [...byMes.keys()].sort();
  const months: Record<string, MonthData> = {};
  const trend: TrendPoint[] = [];
  for (const m of asc) {
    const rows = byMes.get(m)!;
    const s = summarize(rows);
    months[m] = { mes: m, summary: s, rows };
    trend.push({ mes: m, ingreso: s.ingreso, egreso: s.egresoTotal, neto: s.flujoNeto, consumo: s.consumo });
  }
  return { meses: asc.slice().reverse(), trend, months };
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
