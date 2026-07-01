import { bigint, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Dominio "Caja" — libro mayor de ingresos/egresos de Jose, alimentado SOLO por
 * las notificaciones de transacción que llegan al correo (RappiCard = consumo,
 * RappiCuenta/RappiPay = caja). Nadie sube nada a mano: el correo → Worker →
 * `/api/caja/ingest` → estas tablas. La clasificación (flujo + categoría) la hace
 * el hub en un único lugar (`@hub/core/caja`), no el Worker.
 *
 * Idempotencia: `msg_id` (RFC Message-ID del correo, o una huella si faltara)
 * es único por usuario → reingerir el mismo correo (retry en vivo o backfill que
 * pisa la ventana en vivo) no duplica. ponytail: si algún proveedor no manda
 * Message-ID, la ruta sintetiza la huella `fuente:fecha:monto:ref`.
 */
export const cajaTx = pgTable(
  "caja_tx",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    msgId: text("msg_id").notNull(),
    fuente: text("fuente").notNull(), // RappiCard | RappiPay
    tipo: text("tipo").notNull(), // compra | PSE | transferencia_in | transferencia_out | movimiento
    // Clasificación automática. El efectivo = *_manual ?? auto (override de Jose).
    flujo: text("flujo").notNull(), // consumo|ingreso|inversion|pago_tarjeta|movimiento_propio|por_clasificar
    categoria: text("categoria").notNull(),
    // COP entero (sin centavos): bigint por si algún movimiento supera int4 (~2.1B).
    monto: bigint("monto", { mode: "number" }).notNull(),
    comercio: text("comercio"),
    metodo: text("metodo"), // *4418 | RappiCuenta
    ref: text("ref"), // No. de autorización / CUS / Nro. de transacción
    fecha: date("fecha").notNull(), // YYYY-MM-DD, fecha de la transacción (no del correo)
    hora: text("hora"),
    rawSubject: text("raw_subject"), // para auditar/depurar no_parse
    flujoManual: text("flujo_manual"),
    categoriaManual: text("categoria_manual"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("caja_tx_user_msg_idx").on(t.userId, t.msgId),
    index("caja_tx_user_fecha_idx").on(t.userId, t.fecha),
  ],
);

/**
 * Reglas aprendidas de clasificación: "este comercio (keyword) = este flujo/categoría".
 * Se consultan ANTES de las reglas fijas del código → Jose enseña una vez desde el
 * dashboard ("recordar") y todas las futuras (y las pasadas, al reclasificar) caen bien.
 */
export const cajaRule = pgTable(
  "caja_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(), // substring en minúsculas a buscar en el comercio
    flujo: text("flujo").notNull(),
    categoria: text("categoria").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("caja_rule_user_kw_idx").on(t.userId, t.keyword)],
);
