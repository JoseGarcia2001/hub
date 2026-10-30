// Correlación pura obligación ↔ pago (sin DB).
// - "monto": monto EXACTO dentro de la ventana; casa aunque el pago entre por un
//   gateway (A Toda Hora, AVAL) que oculta al beneficiario.
// - "comercio": el comercio contiene alguna keyword, dentro de la ventana.
// - "manual": nunca automático.
import { addDays } from "../fecha";
import type { MatchStrategy } from "./types";

export type CajaLite = { id: string; monto: number; comercio: string | null; fecha: string };
export type InstanciaLite = { montoEsperado: number; fechaEmision: string | null; fechaVencimiento: string };

const DIAS_GRACIA = 20; // margen tras el vencimiento para que aparezca el pago
// Inicio de la ventana cuando no hay fecha de emisión. Debe cubrir pagar apenas llega la
// factura (Vanti emite ~15 días antes) sin alcanzar el pago del mes anterior.
const DIAS_ANTICIPO = 20;

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
