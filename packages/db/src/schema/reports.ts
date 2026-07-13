import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Contenido estructurado del informe semanal de inversiones. Lo genera el agente
 * asesor (skill `informe-portafolio` en ~/Personal) y lo postea por m2m; el hub
 * lo persiste, lo renderiza y notifica por push. Vive aquí (capa más baja) para
 * que `@hub/core` y `apps/web` lo importen sin duplicarlo — mismo patrón que
 * `Position` en investments.
 */
export type ReportLevel = {
  level: number;
  label: string;
  /** Distancia del precio actual al nivel, en % (positivo = nivel por encima). */
  distancePct: number;
  crossedThisWeek?: boolean;
};

export type ReportPayload = {
  /** 3-5 bullets: qué pasó y qué (no) hacer. */
  tldr: string[];
  portfolio: {
    nav: number;
    cash: number;
    positionsValue: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    /** null cuando no hay semana previa contra la cual comparar. */
    weekDelta: { nav: number; navPct: number } | null;
    topMovers: { symbol: string; weekPct: number }[];
    concentration: { top3Pct: number; flags: string[] };
  };
  /** Seguimiento de la tesis cripto (niveles de tesis-cripto.md). null si no aplica. */
  crypto: {
    assets: { symbol: string; price: number; levels: ReportLevel[] }[];
    windowNote: string;
  } | null;
  /** Solo novedades que pasaron el filtro de materialidad, con fuente. */
  companies: { symbol: string; headline: string; source: string; why: string; thesisImpact: string }[];
  /** Posiciones sin novedades materiales — explícito, no implícito. */
  noNews: string[];
  recommendations: {
    action: "MANTENER" | "VIGILAR" | "ANALIZAR" | "CONSIDERAR_VENTA" | "CONSIDERAR_COMPRA";
    symbol: string;
    rationale: string;
    wouldChangeIf: string;
  }[];
  agenda: { date: string; symbol: string; event: string }[];
};

/**
 * Informe semanal de inversiones. Una fila por semana ISO (`2026-W28`); re-postear
 * la misma semana hace upsert (el informe se puede regenerar sin duplicar). La
 * página lee de aquí; el análisis vive fuera del hub (el hub no piensa, publica).
 */
export const investmentReport = pgTable(
  "investment_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Semana ISO: `YYYY-Wnn`. */
    week: text("week").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<ReportPayload>().notNull(),
    /** Informe completo en markdown (fuente de render de respaldo / archivo). */
    markdown: text("markdown").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("investment_report_user_week_uq").on(t.userId, t.week),
    // Índice para "último informe" (ORDER BY generated_at DESC LIMIT 1).
    index("investment_report_user_generated_idx").on(t.userId, t.generatedAt),
  ],
);
