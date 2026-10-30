import "server-only";
import { parse } from "./parse";
import { classify } from "./classify";
import * as gmail from "../gmail";
import { resolveOwnerUserId } from "../owner";
import { summarize, type CajaRow, type CajaSummary } from "./summary";
import {
  addRule, lastTxDate, listAll, listRules, reclassifyAll, setClassification, upsertTx,
} from "./store";
import type { ClassifiedTx, EmailInput, Flujo, Rule } from "./types";

export type { CajaRow, CajaSummary, EmailInput, Flujo, Rule };

/** Remitentes de Rappi (cambiaron de dominio en 2025 sin cambiar el formato). */
const QUERY_REMITENTES = "from:(rappicard.co OR rappipay.co OR rappi.nreply@rappi.com)";

/**
 * Idempotencia: Message-ID, o huella si faltara. Un pago de servicio usa siempre la
 * huella día+monto+referencia: Rappi a veces manda dos comprobantes (dos plantillas)
 * del mismo pago, con Message-ID distinto.
 */
function dedupeKey(email: EmailInput, tx: ClassifiedTx): string {
  if (tx.tipo === "pago_servicio") return `pago_servicio:${tx.fecha}:${tx.monto}:${tx.ref}`;
  return email.messageId || `${tx.fuente}:${tx.fecha}:${tx.monto}:${tx.ref}`;
}

export type IngestResult =
  | { ok: true; created: boolean; tx: ClassifiedTx }
  | { ok: false; reason: string };

/** Un correo → transacción persistida. Idempotente. */
export async function ingest(email: EmailInput): Promise<IngestResult> {
  const parsed = parse(email);
  if (!parsed) return { ok: false, reason: "no_parse" };
  const userId = await resolveOwnerUserId();
  const rules = await listRules(userId);
  const tx = classify(parsed, rules);
  const created = await upsertTx(userId, tx, dedupeKey(email, tx), email.subject || "");
  return { ok: true, created, tx };
}

/** Lote de correos: resuelve dueño y reglas una vez. Idempotente. */
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

export type SyncResult = {
  ventana: string;        // el query de fecha que se usó ("" = histórico completo)
  encontrados: number;    // correos que devolvió Gmail
  created: number;
  duplicated: number;
  skipped: number;
  ultimaFecha: string | null; // max(fecha) DESPUÉS de sincronizar
};

/** Margen hacia atrás desde la última transacción: el banco a veces emite el correo tarde. */
const MARGEN_DIAS = 3;

/**
 * Trae de Gmail lo que le falte a la caja (si el server estuvo apagado, el push del
 * Worker se perdió pero el correo sigue en Gmail) y lo ingiere. Idempotente.
 *
 * La ventana arranca en la última transacción guardada; sin caja previa, todo el
 * histórico. `desde` la fuerza para un hueco que quedó ENTRE transacciones guardadas,
 * que la ventana automática salta.
 */
export async function syncFromGmail(opts: { desde?: string } = {}): Promise<SyncResult> {
  const userId = await resolveOwnerUserId();
  const ultima = await lastTxDate(userId);
  const desde = opts.desde ?? ultima;

  let ventana = "";
  if (desde) {
    const d = new Date(`${desde}T00:00:00Z`);
    if (!opts.desde) d.setUTCDate(d.getUTCDate() - MARGEN_DIAS);
    ventana = `after:${d.toISOString().slice(0, 10).replace(/-/g, "/")}`;
  }

  const session = await gmail.openSession();
  const query = [QUERY_REMITENTES, ventana].filter(Boolean).join(" ");
  const ids = await gmail.listMessageIds(session, query);
  if (ids.length === 0) {
    return { ventana, encontrados: 0, created: 0, duplicated: 0, skipped: 0, ultimaFecha: ultima };
  }

  const emails = await gmail.getEmails(session, ids);
  const res = await ingestBatch(emails);
  return { ventana, encontrados: ids.length, ...res, ultimaFecha: await lastTxDate(userId) };
}

export const gmailConfigured = gmail.isConfigured;
export const GmailAuthError = gmail.GmailAuthError;

/** Datos de un mes: KPIs + movimientos + lo que pide atención. */
export type MonthData = {
  mes: string;
  summary: CajaSummary;
  rows: CajaRow[];
  porClasificar: CajaRow[];
  sinCategoria: string[];
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
    months[m] = {
      mes: m, summary: s, rows,
      porClasificar: rows.filter((r) => r.flujo === "por_clasificar"),
      sinCategoria: [...new Set(rows.filter((r) => r.categoria === "Sin categorizar").map((r) => r.comercio || "—"))],
    };
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
