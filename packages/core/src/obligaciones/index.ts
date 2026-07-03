import "server-only";
import * as push from "../push";
import { parseFactura } from "./parseFactura";
import { matchPago, ventana, type CajaLite } from "./match";
import { CATALOGO, INSTANCIAS_SEMBRADAS } from "./seed";
import {
  cajaRowsDesde, ensureInstancia, getObligacionByKey, listInstancias, listObligaciones,
  marcarPagadoManual, resolveOwnerUserId, setEstado, setNotificado, setPagada,
  upsertInstanciaFactura, upsertObligacion, type Instancia, type Obligacion,
} from "./store";
import type { Cadencia, EmailInput, Estado, MatchStrategy } from "./types";

/**
 * API del dominio "Obligaciones". Correlaciona lo que se debe (factura / fecha fija)
 * con el pago real en Caja, y avisa por push si llega el vencimiento sin pago.
 * `today` (YYYY-MM-DD, zona Bogotá) lo inyecta la ruta → el core queda testeable.
 */

export type { Cadencia, Estado, MatchStrategy, EmailInput };
export { resolveOwnerUserId };

// --- helpers de fecha (puros) ---
function pad(n: number): string { return String(n).padStart(2, "0"); }
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  const t = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(a) - t(b)) / 86_400_000);
}

// ---------- Ingesta de facturas ----------
export type IngestResult =
  | { ok: true; proveedorKey: string; periodo: string; monto: number }
  | { ok: false; reason: string };

/** Un correo de factura → instancia del período (idempotente). Lo llama el Worker (M2M). */
export async function ingestFactura(email: EmailInput): Promise<IngestResult> {
  const f = parseFactura(email);
  if (!f) return { ok: false, reason: "no_parse" };
  const userId = await resolveOwnerUserId();
  const obl = await getObligacionByKey(userId, f.proveedorKey);
  if (!obl) return { ok: false, reason: `obligacion_no_sembrada:${f.proveedorKey}` };
  await upsertInstanciaFactura(userId, obl.id, f, email.messageId ?? null);
  return { ok: true, proveedorKey: f.proveedorKey, periodo: f.periodo, monto: f.monto };
}

// ---------- Reconciliación (casar pagos + marcar estado) ----------
function periodoActual(cadencia: Cadencia, today: string): string {
  return cadencia === "anual" ? today.slice(0, 4) : today.slice(0, 7);
}

/** Para obligaciones "fija" mensual/bimensual: garantiza la instancia del período actual. */
async function asegurarInstanciasFijas(userId: string, obls: Obligacion[], today: string): Promise<void> {
  const [, mesStr] = today.split("-");
  const mes = Number(mesStr);
  for (const o of obls) {
    if (o.fuenteVencimiento !== "fija" || o.cadencia === "anual" || o.diaVencimiento == null) continue;
    if (o.cadencia === "bimensual" && mes % 2 !== 0) continue; // EAAB: meses pares
    const periodo = today.slice(0, 7);
    const venc = `${periodo}-${pad(o.diaVencimiento)}`;
    await ensureInstancia(userId, o.id, periodo, venc, o.montoEsperado ?? 0);
  }
}

export type ReconcileResult = { revisadas: number; pagadas: number; vencidas: number };

export async function reconcile(userId: string, today: string): Promise<ReconcileResult> {
  const obls = await listObligaciones(userId);
  await asegurarInstanciasFijas(userId, obls, today);
  const byId = new Map(obls.map((o) => [o.id, o]));
  const instancias = await listInstancias(userId);

  // Ventana de Caja a cargar: la más temprana entre las instancias abiertas (o 150d atrás).
  let desde = addDays(today, -150);
  for (const i of instancias) {
    if (i.estado === "pagado" || i.pagadoManual) continue;
    const [ini] = ventana({ montoEsperado: i.montoEsperado, fechaEmision: i.fechaEmision, fechaVencimiento: i.fechaVencimiento });
    if (ini < desde) desde = ini;
  }
  const caja: CajaLite[] = await cajaRowsDesde(userId, desde);
  const usados = new Set<string>(instancias.map((i) => i.cajaTxId).filter((x): x is string => !!x));

  let pagadas = 0, vencidas = 0;
  for (const i of instancias) {
    if (i.estado === "pagado" || i.pagadoManual) continue;
    const o = byId.get(i.obligacionId);
    if (!o) continue;
    const txId = matchPago(
      o.matchStrategy as MatchStrategy, o.matchKeywords,
      { montoEsperado: i.montoEsperado, fechaEmision: i.fechaEmision, fechaVencimiento: i.fechaVencimiento },
      caja, usados,
    );
    if (txId) {
      await setPagada(userId, i.id, txId, false);
      usados.add(txId);
      pagadas++;
    } else {
      const nuevo: Estado = today > i.fechaVencimiento ? "vencido" : "pendiente";
      if (nuevo !== i.estado) await setEstado(userId, i.id, nuevo);
      if (nuevo === "vencido") vencidas++;
    }
  }
  return { revisadas: instancias.length, pagadas, vencidas };
}

// ---------- Tick diario (reconcile + push) ----------
function mensajePush(nombre: string, monto: number, dias: number): { title: string; body: string } {
  const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(monto);
  if (dias > 0) return { title: `${nombre} vence en ${dias} día${dias === 1 ? "" : "s"}`, body: `${cop} — sin pago detectado` };
  if (dias === 0) return { title: `${nombre} vence hoy`, body: `${cop} — aún sin pago` };
  return { title: `${nombre} vencido hace ${-dias} día${dias === -1 ? "" : "s"}`, body: `${cop} — sin pago, riesgo de corte` };
}

export async function tick(userId: string, today: string): Promise<{ revisadas: number; avisos: number }> {
  await reconcile(userId, today);
  const obls = new Map((await listObligaciones(userId)).map((o) => [o.id, o]));
  const instancias = await listInstancias(userId);
  let avisos = 0;
  for (const i of instancias) {
    if (i.estado === "pagado" || i.pagadoManual) continue;
    const dias = diffDays(i.fechaVencimiento, today); // >0 faltan, 0 hoy, <0 vencido
    const debe = dias === 3 || dias <= 0; // 3 días antes, el día, y diario si venció
    if (!debe || i.notificadoEn === today) continue;
    const o = obls.get(i.obligacionId);
    if (!o) continue;
    const { title, body } = mensajePush(o.nombre, i.montoEsperado, dias);
    if (push.isEnabled) await push.sendToUser(userId, { title, body, url: "/obligaciones" });
    await setNotificado(userId, i.id, today);
    avisos++;
  }
  return { revisadas: instancias.length, avisos };
}

// ---------- Overview (dashboard) ----------
export type ObligacionItem = {
  id: string; obligacionId: string; nombre: string; proveedor: string; categoria: string;
  periodo: string; monto: number; fechaVencimiento: string; estado: Estado;
  diasRestantes: number; overdueDias: number; cajaTxId: string | null; pagadoManual: boolean;
};
export type Overview = { items: ObligacionItem[]; totalObligaciones: number };

/** Instancias enriquecidas, ordenadas por urgencia (vencido → por vencer → pagado). */
export async function overview(userId: string, today: string): Promise<Overview> {
  const obls = new Map((await listObligaciones(userId)).map((o) => [o.id, o]));
  const items: ObligacionItem[] = [];
  for (const i of await listInstancias(userId)) {
    const o = obls.get(i.obligacionId);
    if (!o) continue;
    const dias = diffDays(i.fechaVencimiento, today);
    items.push({
      id: i.id, obligacionId: i.obligacionId, nombre: o.nombre, proveedor: o.proveedor, categoria: o.categoria,
      periodo: i.periodo, monto: i.montoEsperado, fechaVencimiento: i.fechaVencimiento,
      estado: i.estado as Estado, diasRestantes: dias, overdueDias: dias < 0 ? -dias : 0,
      cajaTxId: i.cajaTxId, pagadoManual: i.pagadoManual,
    });
  }
  const rank = (e: Estado) => (e === "vencido" ? 0 : e === "pendiente" ? 1 : 2);
  items.sort((a, b) => rank(a.estado) - rank(b.estado) || a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  return { items, totalObligaciones: obls.size };
}

/** Override manual de Jose sobre una instancia. */
export async function marcarPagado(userId: string, id: string, pagado: boolean): Promise<void> {
  await marcarPagadoManual(userId, id, pagado);
}

// ---------- Seed (siembra idempotente del catálogo) ----------
export async function sembrar(userId: string): Promise<{ obligaciones: number; instancias: number }> {
  const keyToId = new Map<string, string>();
  for (const o of CATALOGO) keyToId.set(o.proveedorKey, await upsertObligacion(userId, o));
  let instancias = 0;
  for (const s of INSTANCIAS_SEMBRADAS) {
    const oblId = keyToId.get(s.proveedorKey);
    if (!oblId) continue;
    await ensureInstancia(userId, oblId, s.periodo, s.fechaVencimiento, s.monto);
    instancias++;
  }
  return { obligaciones: CATALOGO.length, instancias };
}

export type { Instancia, Obligacion };
