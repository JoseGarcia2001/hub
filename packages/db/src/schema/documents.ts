import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Documento genérico por BLOQUES: un contenedor para cualquier análisis o
 * documento que quiera registrarse en el hub con contenido rico —texto, cifras,
 * tablas y gráficos—. El productor (un agente, una skill) arma una lista de
 * bloques tipados; el hub los persiste y un renderer los pinta en Latón. Es la
 * base ÚNICA de reportes del hub: cada tipo (análisis, informe semanal…) es un
 * documento de un `kind` distinto, no un molde de tabla aparte.
 *
 * Extender = añadir un miembro a `DocBlock` + su `case` en el renderer + su
 * validador. Un `line-chart` o un `area` nuevos son eso y nada más.
 *
 * Texto enriquecido: `prose`, `list` y `callout` admiten markdown inline mínimo
 * —`[texto](url)` (solo http/https), `**negrita**`, `` `código` ``— renderizado
 * de forma segura (nodos React, sin HTML crudo). Sin dependencias.
 */

/** Tono semántico de una cifra/barra. pos/neg = dirección de valor (verde/rojo); brass = neutro de marca. */
export type BlockTone = "pos" | "neg" | "brass";

export type DocBlock =
  | { kind: "heading"; text: string; level?: 2 | 3 }
  /** Párrafos separados por líneas en blanco. Admite markdown inline. */
  | { kind: "prose"; text: string }
  /** Lista de viñetas (o numerada). Cada ítem admite markdown inline. */
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "stat-grid"; items: { label: string; value: string; sub?: string; tone?: BlockTone }[] }
  /**
   * Barras horizontales. `diverging` centra el eje en 0 (negativos a la izquierda,
   * positivos a la derecha) — para netos compra/venta. Sin él, barras por magnitud.
   */
  | {
      kind: "bar-chart";
      title?: string;
      note?: string;
      diverging?: boolean;
      items: { label: string; value: number; sub?: string; tone?: BlockTone }[];
    }
  | { kind: "table"; title?: string; note?: string; columns: string[]; rows: string[][] }
  | { kind: "callout"; tone?: BlockTone; title?: string; text: string };

export type DocumentPayload = { blocks: DocBlock[] };

/**
 * Un documento por (usuario, slug). Re-postear el mismo slug hace upsert
 * (regenerar sin duplicar) — igual criterio que el informe semanal por semana.
 */
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Identificador legible y estable en la URL: `superinversores-q1-2026`. */
    slug: text("slug").notNull(),
    /** Familia del documento para agrupar/filtrar: `superinvestors`, `analysis`, … */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    /** Una línea para la lista y el push. */
    summary: text("summary").notNull(),
    payload: jsonb("payload").$type<DocumentPayload>().notNull(),
    /** Fuente citable del análisis (URL), si aplica. */
    sourceUrl: text("source_url"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_user_slug_uq").on(t.userId, t.slug),
    index("document_user_generated_idx").on(t.userId, t.generatedAt),
  ],
);
