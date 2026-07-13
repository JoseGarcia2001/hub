import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema, validators } from "@hub/db";
import { z } from "zod";

/**
 * Dominio "reports" — informes semanales de inversiones.
 *
 * El ANÁLISIS no vive aquí: lo genera el agente asesor (skill `informe-portafolio`
 * en ~/Personal) y lo postea por m2m. El hub persiste, renderiza y notifica.
 * Una fila por semana ISO; re-postear la misma semana regenera (upsert), no duplica.
 */

export type InvestmentReport = typeof schema.investmentReport.$inferSelect;
export type { ReportPayload, ReportLevel } from "@hub/db/schema";

/** Contrato del POST m2m: lo que manda el agente (el userId lo pone el server). */
export const saveReportInput = validators.insertInvestmentReport
  .pick({ week: true, payload: true, markdown: true })
  .extend({ generatedAt: z.coerce.date() });

export type SaveReportInput = z.infer<typeof saveReportInput>;

/** Persiste el informe de una semana (upsert por (userId, week)). */
export async function save(userId: string, input: SaveReportInput): Promise<void> {
  await db
    .insert(schema.investmentReport)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: [schema.investmentReport.userId, schema.investmentReport.week],
      set: {
        payload: input.payload,
        markdown: input.markdown,
        generatedAt: input.generatedAt,
      },
    });
}

/** Último informe del usuario, o null si aún no hay ninguno. */
export async function getLatest(userId: string): Promise<InvestmentReport | null> {
  const [row] = await db
    .select()
    .from(schema.investmentReport)
    .where(eq(schema.investmentReport.userId, userId))
    .orderBy(desc(schema.investmentReport.generatedAt))
    .limit(1);
  return row ?? null;
}

/** Un informe puntual por semana ISO (`2026-W28`), o null. */
export async function getByWeek(userId: string, week: string): Promise<InvestmentReport | null> {
  const [row] = await db
    .select()
    .from(schema.investmentReport)
    .where(and(eq(schema.investmentReport.userId, userId), eq(schema.investmentReport.week, week)));
  return row ?? null;
}

/** Semanas disponibles (recientes primero) para el selector de la página. */
export function listWeeks(userId: string, limit = 26): Promise<{ week: string; generatedAt: Date }[]> {
  return db
    .select({ week: schema.investmentReport.week, generatedAt: schema.investmentReport.generatedAt })
    .from(schema.investmentReport)
    .where(eq(schema.investmentReport.userId, userId))
    .orderBy(desc(schema.investmentReport.generatedAt))
    .limit(limit);
}

/**
 * Dueño del hub (single-user) — mismo patrón que investments/caja/obligaciones.
 * ponytail: si algún día hay más usuarios, resolver por email explícito.
 */
export async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .orderBy(schema.user.createdAt)
    .limit(1);
  if (!row) {
    throw new Error("No hay usuario provisionado; entra al hub al menos una vez.");
  }
  return row.id;
}

/** Variantes m2m (sin sesión): resuelven el dueño y delegan. */
export async function saveOwnerReport(input: SaveReportInput): Promise<{ userId: string }> {
  const userId = await resolveOwnerUserId();
  await save(userId, input);
  return { userId };
}

export async function getOwnerLatest(): Promise<InvestmentReport | null> {
  return getLatest(await resolveOwnerUserId());
}
