import type { obligaciones } from "@hub/core";

/**
 * Meta por estado. Nota Latón: verde/rojo = solo valor. `pagado` va en reposo (ghost);
 * `pendiente` usa el acento (brass) para pedir atención; `vencido` usa `down` porque es
 * plata en riesgo real (mora / corte), no un "error de UI".
 */
export const ESTADO_META: Record<obligaciones.Estado, { label: string; tone: "up" | "down" | "brass" | "ghost" | "soon" }> = {
  pagado: { label: "Pagado", tone: "ghost" },
  pendiente: { label: "Por pagar", tone: "brass" },
  vencido: { label: "Vencido", tone: "down" },
};

/** Texto relativo del vencimiento. `dias` = fechaVencimiento − hoy. */
export function textoVencimiento(estado: obligaciones.Estado, dias: number): string {
  if (estado === "pagado") return "Pagado";
  if (dias > 1) return `Vence en ${dias} días`;
  if (dias === 1) return "Vence mañana";
  if (dias === 0) return "Vence hoy";
  if (dias === -1) return "Venció ayer";
  return `Vencido hace ${-dias} días`;
}

/** "2026-07-10" → "10 jul 2026" (fecha local, sin corrimiento de zona). */
export function fechaCorta(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** "2026-06" → "jun 2026" (mensual/bimensual); "2026" → "2026" (anual). */
export function periodoLabel(periodo: string): string {
  if (periodo.length === 7) {
    const [y, m] = periodo.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  }
  return periodo;
}
