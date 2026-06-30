import "server-only";
import { desc, eq } from "drizzle-orm";
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
