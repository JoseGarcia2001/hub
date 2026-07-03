export type Cadencia = "mensual" | "bimensual" | "anual";
export type MatchStrategy = "monto" | "comercio" | "manual";
export type FuenteVencimiento = "factura" | "fija";
export type Estado = "pendiente" | "pagado" | "vencido";

/** Correo de factura ya extraído a texto (lo manda el Worker relay). */
export type EmailInput = {
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string | null;
};

/** Factura parseada: qué se debe, de quién y cuándo. `proveedorKey` casa con la obligación. */
export type ParsedFactura = {
  proveedorKey: string; // "enel" | "vanti" | "eaab" | "etb"
  cuentaContrato: string | null;
  periodo: string; // "YYYY-MM"
  monto: number; // COP entero
  fechaEmision: string | null; // YYYY-MM-DD
  fechaVencimiento: string; // YYYY-MM-DD ("pago oportuno")
};
