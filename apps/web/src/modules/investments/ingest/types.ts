/** Tipos de dominio normalizados. Toda fuente (REST, WebSocket, Flex) los produce. */

export interface Position {
  conid: number;
  symbol: string;
  name?: string;
  quantity: number;
  /** Moneda nativa de la posición (p.ej. HKD para papeles de Hong Kong). */
  currency: string;
  /** Costo promedio por acción, en moneda nativa. */
  avgCost: number;
  /** Precio de mercado, en moneda nativa. */
  marketPrice: number;
  /** Valor de mercado YA convertido a moneda base (USD). */
  marketValueBase: number;
  /** P&L no realizado YA convertido a moneda base (USD). */
  unrealizedPnlBase: number;
  /** Costo base (USD) = marketValueBase - unrealizedPnlBase. */
  costBasisBase: number;
  /** Peso sobre el valor total de posiciones. */
  weightPct: number;
}

export interface PortfolioSnapshot {
  accountId: string;
  baseCurrency: string;
  netLiquidation: number;
  cash: number;
  positionsValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  positions: Position[];
  asOf: string;
}

/** El seam: cualquier fuente de datos de inversiones implementa esto. */
export interface InvestmentsSource {
  getSnapshot(): Promise<PortfolioSnapshot>;
}

/** Error tipado para que la UI distinga "gateway caído" de "sesión no autenticada". */
export class InvestmentsSourceError extends Error {
  constructor(
    message: string,
    readonly kind: "unreachable" | "unauthenticated" | "unexpected",
  ) {
    super(message);
    this.name = "InvestmentsSourceError";
  }
}
