import type { Position } from "@hub/db/schema";

/** Re-export del tipo canónico (vive en @hub/db por ser el contenido del jsonb). */
export type { Position };

/**
 * Snapshot que produce una fuente (lo que el bróker reporta en un momento dado),
 * ya normalizado a USD. La capa de persistencia le agrega id/userId/source al
 * guardarlo; esta es la forma "de dominio" que también consume la UI.
 */
export interface PortfolioSnapshot {
  accountId: string;
  baseCurrency: string;
  netLiquidation: number;
  cash: number;
  positionsValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  positions: Position[];
  /** ISO-8601. Momento de los datos según el bróker. */
  asOf: string;
}

/** El seam: toda fuente de datos (Flex headless, gateway REST, …) implementa esto. */
export interface InvestmentsSource {
  /** Identifica la fuente que produjo el snapshot ('flex' | 'cp-rest'). */
  readonly name: string;
  getSnapshot(): Promise<PortfolioSnapshot>;
}

/** Error tipado para distinguir el modo de fallo en la ingesta. */
export class InvestmentsSourceError extends Error {
  constructor(
    message: string,
    readonly kind: "unreachable" | "unauthenticated" | "unexpected" | "config",
  ) {
    super(message);
    this.name = "InvestmentsSourceError";
  }
}
