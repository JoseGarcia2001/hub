import "server-only";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { Position } from "@hub/db/schema";
import { config } from "./config";
import { InvestmentsSource, InvestmentsSourceError, type PortfolioSnapshot } from "./types";

/**
 * Fuente HEADLESS: IBKR Flex Web Service. No requiere el gateway Java, ni login
 * interactivo, ni 2FA — solo un token (de larga vida) y el id de una Flex Query
 * pre-configurada en Client Portal. Es la fuente correcta para la ingesta
 * automática (cron) en el server always-on.
 *
 * Flujo de 2 pasos (doc IBKR Flex Web Service v3):
 *   1) SendRequest(t=token, q=queryId) → ReferenceCode
 *   2) GetStatement(t=token, q=ReferenceCode) → XML del statement
 *      (mientras se genera responde ErrorCode 1019 → se reintenta con backoff)
 *
 * La Flex Query (tipo Activity) debe incluir, EN MONEDA BASE:
 *   - "Net Asset Value (NAV) in Base"  → elemento EquitySummaryInBase (total, cash)
 *   - "Open Positions" nivel Summary   → elemento OpenPositions (una fila por papel)
 * Campos de Open Positions a habilitar: conid, symbol, description, position,
 * markPrice, positionValue, costBasisPrice, fifoPnlUnrealized, currency, fxRateToBase.
 * Como pedimos valores en base, la conversión HKD→USD ya viene en fxRateToBase.
 */

const BASE = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
const VERSION = "3";
const MAX_GENERATION_RETRIES = 6;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false, // dejamos números como string → coerce en Zod
});

const num = z.coerce.number();

const FlexResponseMeta = z.object({
  Status: z.string(),
  ReferenceCode: z.coerce.string().optional(),
  Url: z.string().optional(),
  ErrorCode: z.coerce.string().optional(),
  ErrorMessage: z.string().optional(),
});

const OpenPositionRow = z.object({
  conid: num,
  symbol: z.string().optional(),
  description: z.string().optional(),
  position: num,
  markPrice: num.optional(),
  positionValue: num.optional(),
  costBasisPrice: num.optional(),
  fifoPnlUnrealized: num.optional(),
  currency: z.string().optional(),
  fxRateToBase: num.optional(),
});

const EquitySummaryRow = z.object({
  total: num.optional(),
  cash: num.optional(),
  reportDate: z.coerce.string().optional(),
});

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Acceso defensivo a un nodo del XML (objeto o vacío), sin usar `any`. */
function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}

/** fast-xml-parser entrega objeto cuando hay 1 elemento y array cuando hay varios. */
function asArray(x: unknown): unknown[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const detail = r.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    throw new InvestmentsSourceError(`Respuesta inesperada del Flex en ${what}: ${detail}`, "unexpected");
  }
  return r.data;
}

/** yyyyMMdd → ISO (medianoche UTC). null si no parsea. */
function parseFlexDate(d?: string): string | null {
  if (!d || !/^\d{8}$/.test(d)) return null;
  const t = Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

async function flexGet(endpoint: "SendRequest" | "GetStatement", q: string): Promise<Record<string, unknown>> {
  const token = config.flex.token;
  if (!token) {
    throw new InvestmentsSourceError(
      "Falta IBKR_FLEX_TOKEN. Genéralo en Client Portal → Settings → Flex Web Service.",
      "config",
    );
  }
  const url = `${BASE}/${endpoint}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}&v=${VERSION}`;
  let text: string;
  try {
    const res = await fetch(url);
    text = await res.text();
  } catch {
    throw new InvestmentsSourceError("No se pudo contactar el Flex Web Service de IBKR.", "unreachable");
  }
  try {
    return obj(parser.parse(text));
  } catch {
    throw new InvestmentsSourceError(`Respuesta no-XML del Flex en ${endpoint}.`, "unexpected");
  }
}

async function sendRequest(): Promise<string> {
  if (!config.flex.queryId) {
    throw new InvestmentsSourceError("Falta IBKR_FLEX_QUERY_ID.", "config");
  }
  const xml = await flexGet("SendRequest", config.flex.queryId);
  const meta = parseOrThrow(FlexResponseMeta, xml.FlexStatementResponse, "SendRequest");
  if (meta.Status !== "Success" || !meta.ReferenceCode) {
    // 1003 = token inválido/expirado; resto = config/uso.
    const kind = meta.ErrorCode === "1003" ? "unauthenticated" : "config";
    throw new InvestmentsSourceError(
      `SendRequest falló: ${meta.ErrorCode ?? ""} ${meta.ErrorMessage ?? meta.Status}`.trim(),
      kind,
    );
  }
  return meta.ReferenceCode;
}

async function getStatement(refCode: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const xml = await flexGet("GetStatement", refCode);
    if (xml.FlexQueryResponse) return xml; // statement listo
    if (xml.FlexStatementResponse) {
      const meta = parseOrThrow(FlexResponseMeta, xml.FlexStatementResponse, "GetStatement");
      if (meta.ErrorCode === "1019") {
        // "Statement generation in progress" → esperar y reintentar.
        await delay(2000 * (attempt + 1));
        continue;
      }
      throw new InvestmentsSourceError(
        `GetStatement falló: ${meta.ErrorCode ?? ""} ${meta.ErrorMessage ?? meta.Status}`.trim(),
        "unexpected",
      );
    }
    throw new InvestmentsSourceError("GetStatement: respuesta inesperada.", "unexpected");
  }
  throw new InvestmentsSourceError("El statement Flex no se generó a tiempo (reintentos agotados).", "unreachable");
}

/** Objeto del statement ya parseado → snapshot normalizado a USD. */
function buildSnapshot(root: Record<string, unknown>): PortfolioSnapshot {
  const statements = obj(obj(root.FlexQueryResponse).FlexStatements);
  const stmt = obj(asArray(statements.FlexStatement)[0]);
  if (!Object.keys(stmt).length) {
    throw new InvestmentsSourceError("Statement Flex vacío (sin FlexStatement).", "unexpected");
  }

  const accountId = String(stmt.accountId ?? "");

  // NAV en base: puede traer varias fechas → tomamos la más reciente.
  const equity = asArray(obj(stmt.EquitySummaryInBase).EquitySummaryByReportDateInBase)
    .map((r) => parseOrThrow(EquitySummaryRow, r, "EquitySummaryInBase"))
    .at(-1);
  const netLiquidation = equity?.total ?? 0;
  const cash = equity?.cash ?? 0;

  const positions: Position[] = asArray(obj(stmt.OpenPositions).OpenPosition)
    .map((r) => parseOrThrow(OpenPositionRow, r, "OpenPositions"))
    .map((r) => {
      const currency = r.currency ?? "USD";
      const fx = r.fxRateToBase ?? 1; // HKD→USD, etc., ya viene del Flex
      const marketValueBase = (r.positionValue ?? 0) * fx;
      const unrealizedPnlBase = (r.fifoPnlUnrealized ?? 0) * fx;
      return {
        conid: r.conid,
        symbol: r.symbol ?? r.description ?? String(r.conid),
        name: r.description || undefined,
        quantity: r.position,
        currency,
        avgCost: r.costBasisPrice ?? 0,
        marketPrice: r.markPrice ?? 0,
        marketValueBase,
        unrealizedPnlBase,
        costBasisBase: marketValueBase - unrealizedPnlBase,
        weightPct: 0,
      };
    });

  const positionsValue = positions.reduce((s, p) => s + p.marketValueBase, 0);
  const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnlBase, 0);
  const costBasis = positionsValue - unrealizedPnl;
  for (const p of positions) {
    p.weightPct = positionsValue ? (p.marketValueBase / positionsValue) * 100 : 0;
  }
  positions.sort((a, b) => b.marketValueBase - a.marketValueBase);

  return {
    accountId,
    baseCurrency: "USD",
    netLiquidation,
    cash,
    positionsValue,
    unrealizedPnl,
    unrealizedPnlPct: costBasis ? (unrealizedPnl / costBasis) * 100 : 0,
    positions,
    asOf: parseFlexDate(equity?.reportDate) ?? new Date().toISOString(),
  };
}

/** Parsea el XML crudo de un statement. Exportada para el self-check. */
export function parseStatementXml(xmlText: string): PortfolioSnapshot {
  return buildSnapshot(obj(parser.parse(xmlText)));
}

export class FlexSource implements InvestmentsSource {
  readonly name = "flex";

  async getSnapshot(): Promise<PortfolioSnapshot> {
    const refCode = await sendRequest();
    const xml = await getStatement(refCode); // ya es FlexQueryResponse parseado
    return buildSnapshot(xml);
  }
}
