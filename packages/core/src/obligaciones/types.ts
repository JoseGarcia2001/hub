export type Cadencia = "mensual" | "bimensual" | "anual";
export type MatchStrategy = "monto" | "comercio" | "manual";
export type FuenteVencimiento = "factura" | "fija";
export type Estado = "pendiente" | "pagado" | "vencido";

export type { EmailInput } from "../gmail";

/** Factura parseada: qué se debe, de quién y cuándo. `proveedorKey` casa con la obligación. */
export type ParsedFactura = {
  proveedorKey: string; // "enel" | "vanti" | "eaab" | "etb"
  cuentaContrato: string | null;
  periodo: string; // "YYYY-MM"
  monto: number; // COP entero
  fechaEmision: string | null; // YYYY-MM-DD
  fechaVencimiento: string; // YYYY-MM-DD ("pago oportuno")
};
