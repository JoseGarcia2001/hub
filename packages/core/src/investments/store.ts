import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@hub/db";
import type { PortfolioSnapshot } from "./types";

/** Snapshot persistido = el de dominio + la fuente que lo produjo. */
export type StoredSnapshot = PortfolioSnapshot & { source: string };

/** Persiste un snapshot para el usuario dado. Lo llama la ingesta (headless). */
export async function saveSnapshot(
  userId: string,
  snap: PortfolioSnapshot,
  source: string,
): Promise<void> {
  await db.insert(schema.portfolioSnapshot).values({
    userId,
    accountId: snap.accountId,
    baseCurrency: snap.baseCurrency,
    netLiquidation: snap.netLiquidation,
    cash: snap.cash,
    positionsValue: snap.positionsValue,
    unrealizedPnl: snap.unrealizedPnl,
    unrealizedPnlPct: snap.unrealizedPnlPct,
    positions: snap.positions,
    source,
    asOf: new Date(snap.asOf),
  });
}

/** Último snapshot del usuario, o null si aún no hay ninguno. Lo lee la página. */
export async function getLatestSnapshot(userId: string): Promise<StoredSnapshot | null> {
  const [row] = await db
    .select()
    .from(schema.portfolioSnapshot)
    .where(eq(schema.portfolioSnapshot.userId, userId))
    // as_of = fecha del dato; creado_en desempata si se ingiere el mismo día más
    // de una vez (re-ingesta) → siempre el snapshot más recientemente ingerido.
    .orderBy(desc(schema.portfolioSnapshot.asOf), desc(schema.portfolioSnapshot.creadoEn))
    .limit(1);
  if (!row) return null;
  return {
    accountId: row.accountId,
    baseCurrency: row.baseCurrency,
    netLiquidation: row.netLiquidation,
    cash: row.cash,
    positionsValue: row.positionsValue,
    unrealizedPnl: row.unrealizedPnl,
    unrealizedPnlPct: row.unrealizedPnlPct,
    positions: row.positions,
    asOf: row.asOf.toISOString(),
    source: row.source,
  };
}

/**
 * Snapshots de los últimos `days` días (viejo → nuevo), para que el informe
 * semanal calcule deltas y top movers. Si un día se re-ingirió, ese `asOf` puede
 * repetirse — el consumidor se queda con el último por fecha (creado_en desempata
 * por el orden).
 */
export async function getHistory(userId: string, days: number): Promise<StoredSnapshot[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select()
    .from(schema.portfolioSnapshot)
    .where(and(eq(schema.portfolioSnapshot.userId, userId), gte(schema.portfolioSnapshot.asOf, since)))
    .orderBy(schema.portfolioSnapshot.asOf, schema.portfolioSnapshot.creadoEn);
  return rows.map((row) => ({
    accountId: row.accountId,
    baseCurrency: row.baseCurrency,
    netLiquidation: row.netLiquidation,
    cash: row.cash,
    positionsValue: row.positionsValue,
    unrealizedPnl: row.unrealizedPnl,
    unrealizedPnlPct: row.unrealizedPnlPct,
    positions: row.positions,
    asOf: row.asOf.toISOString(),
    source: row.source,
  }));
}

/**
 * Dueño del portafolio. Hoy el hub es single-user, así que es el primer (único)
 * usuario provisionado. ponytail: si entran asesores como lectores, resolver el
 * dueño por un email explícito en vez del primero.
 */
export async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .orderBy(schema.user.createdAt)
    .limit(1);
  if (!row) {
    throw new Error("No hay usuario provisionado; entra al hub al menos una vez antes de ingerir.");
  }
  return row.id;
}
