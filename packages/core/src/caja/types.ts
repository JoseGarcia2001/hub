/** Los seis flujos de caja. Un tracker confiable NO suma todo como gasto. */
export type Flujo =
  | "consumo" // gasto real de vida
  | "ingreso" // plata nueva que entra (nómina, terceros)
  | "inversion" // fondeo DolarApp → IBKR
  | "pago_tarjeta" // pago de tarjetas de crédito
  | "movimiento_propio" // mover plata entre cuentas propias (Nequi, Bancolombia…)
  | "por_clasificar"; // red de seguridad: Jose lo etiqueta una vez

/** Fuente cruda que produce el parser, antes de clasificar. */
export type ParsedTx = {
  fuente: "RappiCard" | "RappiPay";
  tipo: string; // compra | PSE | transferencia_in | transferencia_out | movimiento
  monto: number; // COP entero
  comercio: string;
  metodo: string;
  ref: string;
  fecha: string; // YYYY-MM-DD
  hora: string;
};

/** Correo ya extraído a texto plano (lo que manda el Worker o el backfill). */
export type EmailInput = {
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string | null;
};

/** Regla aprendida: si `keyword` aparece en el comercio → este flujo/categoría. */
export type Rule = { keyword: string; flujo: Flujo; categoria: string };

export type ClassifiedTx = ParsedTx & { flujo: Flujo; categoria: string };
