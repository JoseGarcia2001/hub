import type { caja } from "@hub/core";

/** Los seis flujos, con etiqueta y tono para la UI. */
export const FLUJOS: { value: caja.Flujo; label: string }[] = [
  { value: "consumo", label: "Consumo" },
  { value: "ingreso", label: "Ingreso" },
  { value: "inversion", label: "Inversión" },
  { value: "pago_tarjeta", label: "Pago tarjeta" },
  { value: "movimiento_propio", label: "Movimiento propio" },
  { value: "por_clasificar", label: "Por clasificar" },
];

export const FLUJO_LABEL: Record<caja.Flujo, string> = Object.fromEntries(
  FLUJOS.map((f) => [f.value, f.label]),
) as Record<caja.Flujo, string>;

/** Categorías conocidas — alimentan el datalist del corrector (Jose puede escribir otra). */
export const CATEGORIAS = [
  "Transporte", "Mercado", "Domicilios", "Restaurantes", "Salud", "Suscripciones",
  "Servicios", "Compras", "Ocio", "Viajes", "Vivienda", "Transferencias",
  "Nómina", "Otros ingresos", "DolarApp → IBKR", "Visa LATAM Occidente",
  "Davivienda", "Nu", "Nequi", "Bancolombia", "Daviplata", "Por clasificar", "Sin categorizar",
];

/** Mes YYYY-MM → "junio 2026" para mostrar. */
export function mesLabel(mes: string): string {
  if (!mes) return "";
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
