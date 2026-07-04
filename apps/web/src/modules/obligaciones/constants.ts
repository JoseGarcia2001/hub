import type { obligaciones } from "@hub/core";

/**
 * Horizonte de relevancia: una obligación pide atención si venció o vence dentro
 * de estos días. Más allá (SOAT en noviembre, tecno en febrero) es "Más adelante" —
 * visible pero en reposo, sin competir con lo urgente.
 */
export const HORIZONTE_DIAS = 30;

export function esUrgente(it: obligaciones.ObligacionItem): boolean {
  return it.estado === "vencido" || (it.estado === "pendiente" && it.diasRestantes <= HORIZONTE_DIAS);
}

/** "2026-07-10" → "10 jul 2026" (fecha local, sin corrimiento de zona). */
export function fechaCorta(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** Texto del vencimiento: relativo si está cerca (donde el día cuenta), absoluto si es lejos. */
export function textoVencimiento(estado: obligaciones.Estado, dias: number, fecha: string): string {
  if (estado === "pagado") return "Pagado";
  if (dias < -1) return `Venció hace ${-dias} días`;
  if (dias === -1) return "Venció ayer";
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  if (dias <= HORIZONTE_DIAS) return `Vence en ${dias} días`;
  return `Vence el ${fechaCorta(fecha)}`;
}

/** "2026-06" → "jun 2026" (mensual/bimensual); "2026" → "2026" (anual). */
export function periodoLabel(periodo: string): string {
  if (periodo.length === 7) {
    const [y, m] = periodo.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  }
  return periodo;
}
