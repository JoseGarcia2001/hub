import "server-only";
import { Agent, fetch as undiciFetch } from "undici";
import { z } from "zod";
import type { Position } from "@hub/db/schema";
import { config } from "./config";
import { InvestmentsSource, InvestmentsSourceError, type PortfolioSnapshot } from "./types";

/**
 * Fuente del IBKR Client Portal Web API (gateway local, cert self-signed).
 * Requiere el gateway Java corriendo + login interactivo (la sesión caduca). Por
 * eso NO es la fuente de la ingesta automática: sirve para refrescar a demanda
 * desde la máquina donde corre el gateway. La fuente headless es `flex`.
 *
 * El gateway devuelve mktValue/unrealizedPnl en MONEDA NATIVA de cada posición
 * (HKD para papeles de Hong Kong, etc.). Se convierte a USD con el exchangerate
 * del ledger. Toda respuesta se valida con Zod en la frontera.
 */

const num = z.coerce.number();
const AccountsResponse = z.array(z.object({ accountId: z.string() }));
const LedgerResponse = z.record(z.string(), z.object({ exchangerate: num.optional() }));
const PositionsResponse = z.array(
  z.object({
    conid: num,
    position: num,
    ticker: z.string().optional(),
    contractDesc: z.string().optional(),
    name: z.string().optional(),
    currency: z.string().optional(),
    avgCost: num.optional(),
    mktPrice: num.optional(),
    mktValue: num.optional(),
    unrealizedPnl: num.optional(),
  }),
);
const SummaryResponse = z.record(z.string(), z.object({ amount: num.optional() }));

// localhost con cert self-signed: aceptarlo solo para el gateway local.
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

/** GET/POST al gateway. Distingue gateway caído de sesión no autenticada. */
async function cpFetch(path: string, method: "GET" | "POST" = "GET"): Promise<unknown> {
  const url = `${config.cp.base}${path}`;
  let res;
  try {
    res = await undiciFetch(url, { method, dispatcher });
  } catch {
    throw new InvestmentsSourceError(
      `No se pudo contactar el gateway IBKR en ${config.cp.base}. ¿Está corriendo cpgateway-run.sh?`,
      "unreachable",
    );
  }
  if (res.status === 401) {
    throw new InvestmentsSourceError("Sesión IBKR no autenticada.", "unauthenticated");
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // El gateway devuelve HTML cuando la sesión no está autenticada.
    throw new InvestmentsSourceError(
      "Sesión IBKR no autenticada. Entra a https://localhost:5055 y loguéate.",
      "unauthenticated",
    );
  }
}

/** Valida en la frontera: shape inesperado → error claro, no datos basura silenciosos. */
function parse<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const detail = r.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    throw new InvestmentsSourceError(
      `Respuesta inesperada del gateway IBKR en ${what}: ${detail}`,
      "unexpected",
    );
  }
  return r.data;
}

async function fetchJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return parse(schema, await cpFetch(path), path);
}

async function resolveAccountId(): Promise<string> {
  if (config.cp.accountId) return config.cp.accountId;
  const accounts = await fetchJson("/portfolio/accounts", AccountsResponse);
  if (accounts.length === 0) {
    throw new InvestmentsSourceError("Sin cuentas; sesión no autenticada.", "unauthenticated");
  }
  return accounts[0].accountId;
}

/** currency -> tasa para convertir a base (USD). USD = 1. */
async function fxMap(accountId: string): Promise<Record<string, number>> {
  const ledger = await fetchJson(`/portfolio/${accountId}/ledger`, LedgerResponse);
  const fx: Record<string, number> = { USD: 1 };
  for (const [cur, row] of Object.entries(ledger)) {
    if (cur === "BASE") continue;
    fx[cur] = row.exchangerate || 1;
  }
  return fx;
}

async function fetchPositions(accountId: string, fx: Record<string, number>): Promise<Position[]> {
  const out: Position[] = [];
  for (let page = 0; page < 20; page++) {
    const rows = await fetchJson(`/portfolio/${accountId}/positions/${page}`, PositionsResponse);
    if (rows.length === 0) break;
    for (const r of rows) {
      const currency = r.currency ?? "USD";
      const rate = fx[currency] ?? 1;
      const marketValueBase = (r.mktValue ?? 0) * rate;
      const unrealizedPnlBase = (r.unrealizedPnl ?? 0) * rate;
      out.push({
        conid: r.conid,
        symbol: r.ticker ?? r.contractDesc ?? String(r.conid),
        name: r.name || undefined,
        quantity: r.position,
        currency,
        avgCost: r.avgCost ?? 0,
        marketPrice: r.mktPrice ?? 0,
        marketValueBase,
        unrealizedPnlBase,
        costBasisBase: marketValueBase - unrealizedPnlBase,
        weightPct: 0, // se completa abajo con el total
      });
    }
    if (rows.length < 30) break;
  }
  return out;
}

export class CpRestSource implements InvestmentsSource {
  readonly name = "cp-rest";

  async getSnapshot(): Promise<PortfolioSnapshot> {
    const accountId = await resolveAccountId();
    await cpFetch("/tickle", "POST"); // keepalive de sesión (respuesta ignorada)

    const [fx, summary] = await Promise.all([
      fxMap(accountId),
      fetchJson(`/portfolio/${accountId}/summary`, SummaryResponse),
    ]);
    const positions = await fetchPositions(accountId, fx);

    const positionsValue = positions.reduce((s, p) => s + p.marketValueBase, 0);
    const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnlBase, 0);
    const costBasis = positionsValue - unrealizedPnl;
    for (const p of positions) {
      p.weightPct = positionsValue ? (p.marketValueBase / positionsValue) * 100 : 0;
    }
    positions.sort((a, b) => b.marketValueBase - a.marketValueBase);

    const sumVal = (k: string) => summary[k]?.amount ?? 0;
    return {
      accountId,
      baseCurrency: "USD",
      netLiquidation: sumVal("netliquidation"),
      cash: sumVal("totalcashvalue"),
      positionsValue,
      unrealizedPnl,
      unrealizedPnlPct: costBasis ? (unrealizedPnl / costBasis) * 100 : 0,
      positions,
      asOf: new Date().toISOString(),
    };
  }
}
