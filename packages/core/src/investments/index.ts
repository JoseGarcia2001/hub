import "server-only";
import { config } from "./config";
import { CpRestSource } from "./cp-rest";
import { FlexSource } from "./flex";
import { resolveOwnerUserId, saveSnapshot } from "./store";
import type { InvestmentsSource } from "./types";

/**
 * API pública del dominio inversiones. `apps/web` solo importa de aquí.
 * - La página LEE con `getLatestSnapshot` (de la DB, siempre disponible).
 * - El cron ESCRIBE con `ingest` (lee del bróker headless y persiste).
 */

export type { PortfolioSnapshot, Position } from "./types";
export { InvestmentsSourceError } from "./types";
export { getLatestSnapshot } from "./store";
export type { StoredSnapshot } from "./store";

function selectSource(): InvestmentsSource {
  return config.source === "cp-rest" ? new CpRestSource() : new FlexSource();
}

export interface IngestResult {
  asOf: string;
  positions: number;
  netLiquidation: number;
  source: string;
}

/** Lee del bróker (fuente headless por defecto) y persiste un snapshot. Lo llama el cron. */
export async function ingest(): Promise<IngestResult> {
  const userId = await resolveOwnerUserId();
  const source = selectSource();
  const snap = await source.getSnapshot();
  await saveSnapshot(userId, snap, source.name);
  return {
    asOf: snap.asOf,
    positions: snap.positions.length,
    netLiquidation: snap.netLiquidation,
    source: source.name,
  };
}
