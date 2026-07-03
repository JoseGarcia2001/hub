// Correlación pura obligación↔pago. SIN DB → testeable. Dado el registro de la
// obligación, una instancia (lo que se debe + cuándo) y las tx de Caja del período,
// devuelve el id de la tx que la pagó, o null.
//
// - "monto": monto EXACTO de la factura ↔ tx, dentro de la ventana. Desenmascara el
//   gateway (ENEL entra por "A Toda Hora"/"AVAL", pero el monto exacto lo delata).
// - "comercio": el comercio contiene algún keyword, dentro de la ventana.
// - "manual": nunca auto (solo Jose lo marca).
import type { MatchStrategy } from "./types";

export type CajaLite = { id: string; monto: number; comercio: string | null; fecha: string };
export type InstanciaLite = { montoEsperado: number; fechaEmision: string | null; fechaVencimiento: string };

const DIAS_GRACIA = 20; // margen tras el vencimiento para que aparezca el pago
const DIAS_ANTICIPO = 45; // por si paga antes de emitir (cota inferior si no hay emisión)

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Ventana [inicio, fin] en la que un pago cuenta para esta instancia. */
export function ventana(inst: InstanciaLite): [string, string] {
  const inicio = inst.fechaEmision ?? addDays(inst.fechaVencimiento, -DIAS_ANTICIPO);
  return [inicio, addDays(inst.fechaVencimiento, DIAS_GRACIA)];
}

/** Devuelve el id de la tx de Caja que paga la instancia, o null. `usados` evita doble-link. */
export function matchPago(
  strategy: MatchStrategy,
  keywords: string[] | null,
  inst: InstanciaLite,
  caja: CajaLite[],
  usados: Set<string> = new Set(),
): string | null {
  if (strategy === "manual") return null;
  const [ini, fin] = ventana(inst);
  const enVentana = caja.filter((t) => !usados.has(t.id) && t.fecha >= ini && t.fecha <= fin);

  if (strategy === "monto") {
    const hit = enVentana.find((t) => t.monto === inst.montoEsperado);
    return hit?.id ?? null;
  }
  // "comercio"
  const kws = (keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
  if (kws.length === 0) return null;
  const hit = enVentana.find((t) => {
    const c = (t.comercio ?? "").toLowerCase();
    return kws.some((k) => c.includes(k));
  });
  return hit?.id ?? null;
}
