import { bigint, boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Dominio "Obligaciones" — pagos recurrentes de Jose (servicios públicos, moto).
 * Correlaciona una OBLIGACIÓN (cuánto y cuándo se debe) con su PAGO real en Caja.
 *
 * Idea central: la FACTURA (correo del servicio: ENEL/Vanti/EAAB/ETB) dice el monto
 * exacto y el "pago oportuno"; Caja dice qué se pagó. El monto exacto los une —incluso
 * cuando el pago entra por un gateway (A Toda Hora/AVAL) que enmascara al beneficiario—.
 * Si llega el vencimiento sin un pago que cuadre → push (riesgo de corte).
 *
 * Dos capas:
 *  - `obligacion`  = el registro estable (sembrado): qué es, cada cuánto, cómo se casa.
 *  - `obligacion_instancia` = una ocurrencia de un período (una factura / un año).
 */
export const obligacion = pgTable(
  "obligacion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Slug estable que emite el parser de factura para casar correo→obligación (ej. "enel").
    proveedorKey: text("proveedor_key").notNull(),
    nombre: text("nombre").notNull(), // "Luz ENEL"
    proveedor: text("proveedor").notNull(), // "ENEL Colombia"
    categoria: text("categoria").notNull(), // "Servicios" | "Vehículo" …
    cadencia: text("cadencia").notNull(), // mensual | bimensual | anual
    cuentaContrato: text("cuenta_contrato"), // "7487178-4"
    // De dónde sale el vencimiento: "factura" (lo trae el correo) | "fija" (fecha conocida).
    fuenteVencimiento: text("fuente_vencimiento").notNull(),
    // Cómo se casa el pago: "monto" (monto exacto de factura ↔ tx) | "comercio" (keyword) | "manual".
    matchStrategy: text("match_strategy").notNull(),
    matchKeywords: text("match_keywords").array(), // para strategy "comercio" (moto)
    montoEsperado: bigint("monto_esperado", { mode: "number" }), // estimado (obligaciones fijas)
    // Para fuenteVencimiento="fija": día (+ mes si es anual) del vencimiento.
    diaVencimiento: integer("dia_vencimiento"),
    mesVencimiento: integer("mes_vencimiento"),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("obligacion_user_proveedor_idx").on(t.userId, t.proveedorKey)],
);

/**
 * Una ocurrencia concreta: la factura de ENEL de 2026-07, o el SOAT de 2026.
 * La ingesta de facturas la crea/actualiza (idempotente por período); la reconciliación
 * la casa contra Caja y marca estado. Manual gana: `pagado_manual` es la salida de escape
 * para lo que Caja no ve.
 */
export const obligacionInstancia = pgTable(
  "obligacion_instancia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    obligacionId: uuid("obligacion_id")
      .notNull()
      .references(() => obligacion.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(), // "2026-07" (mensual/bimensual) | "2026" (anual)
    montoEsperado: bigint("monto_esperado", { mode: "number" }).notNull(),
    fechaEmision: date("fecha_emision"),
    fechaVencimiento: date("fecha_vencimiento").notNull(), // "pago oportuno"
    estado: text("estado").notNull().default("pendiente"), // pendiente | pagado | vencido
    // Link lógico a la tx de Caja que la pagó (sin FK: mantiene los dominios desacoplados).
    cajaTxId: uuid("caja_tx_id"),
    pagadoManual: boolean("pagado_manual").notNull().default(false),
    facturaMsgId: text("factura_msg_id"), // auditoría de qué correo la generó
    notificadoEn: date("notificado_en"), // último push (throttle 1/día)
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("obligacion_instancia_periodo_idx").on(t.obligacionId, t.periodo),
    index("obligacion_instancia_user_venc_idx").on(t.userId, t.fechaVencimiento),
  ],
);
