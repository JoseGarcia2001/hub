// Agregación pura del flujo de caja de un mes (sin DB). Portado de resumen() del
// prototipo, pero devuelve datos para la UI en vez de imprimir. Opera sobre el
// flujo/categoría EFECTIVOS (override de Jose ya aplicado por el store).
import type { Flujo } from "./types";

export type CajaRow = {
  id: string;
  fuente: string;
  tipo: string;
  flujo: Flujo;
  categoria: string;
  monto: number;
  comercio: string | null;
  metodo: string | null;
  ref: string | null;
  fecha: string; // YYYY-MM-DD
  hora: string | null;
  overridden: boolean;
};

export type CajaSummary = {
  ingreso: number;
  consumo: number;
  pagoTarjeta: number;
  inversion: number;
  porClasificar: number;
  egresoTotal: number; // consumo + tarjeta + inversión + por_clasificar
  flujoNeto: number; // ingreso − egreso
  movIn: number; // movimiento entre cuentas propias (neutral)
  movOut: number;
  nConsumo: number;
  consumoPorCategoria: { categoria: string; monto: number; n: number }[];
  topComercios: { comercio: string; monto: number }[];
};

export function summarize(rows: CajaRow[]): CajaSummary {
  const tot = (f: Flujo) => rows.filter((r) => r.flujo === f).reduce((s, r) => s + r.monto, 0);
  const ingreso = tot("ingreso");
  const consumo = tot("consumo");
  const pagoTarjeta = tot("pago_tarjeta");
  const inversion = tot("inversion");
  const porClasificar = tot("por_clasificar");
  const egresoTotal = consumo + pagoTarjeta + inversion + porClasificar;

  const mov = rows.filter((r) => r.flujo === "movimiento_propio");
  const movIn = mov.filter((r) => r.tipo === "transferencia_in").reduce((s, r) => s + r.monto, 0);
  const movOut = mov.filter((r) => r.tipo !== "transferencia_in").reduce((s, r) => s + r.monto, 0);

  const consumoRows = rows.filter((r) => r.flujo === "consumo");
  const catMap = new Map<string, { monto: number; n: number }>();
  for (const r of consumoRows) {
    const e = catMap.get(r.categoria) ?? { monto: 0, n: 0 };
    e.monto += r.monto;
    e.n += 1;
    catMap.set(r.categoria, e);
  }
  const consumoPorCategoria = [...catMap.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.monto - a.monto);

  const comMap = new Map<string, number>();
  for (const r of consumoRows) {
    const key = r.comercio || "—";
    comMap.set(key, (comMap.get(key) ?? 0) + r.monto);
  }
  const topComercios = [...comMap.entries()]
    .map(([comercio, monto]) => ({ comercio, monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10);

  return {
    ingreso, consumo, pagoTarjeta, inversion, porClasificar, egresoTotal,
    flujoNeto: ingreso - egresoTotal, movIn, movOut,
    nConsumo: consumoRows.length, consumoPorCategoria, topComercios,
  };
}
