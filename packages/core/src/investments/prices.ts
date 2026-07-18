import "server-only";
import { z } from "zod";

/**
 * Precios de la última semana por acción, para las sparklines del dashboard.
 * Fuente: Yahoo Finance (endpoint `chart`, sin API key). Server-only y validado
 * con Zod en la frontera. NO usa la DB ni el bróker: la línea de "precio de
 * compra" ya vive en el snapshot (`avgCost`); esto solo trae la serie de mercado.
 *
 * Cache: en memoria de proceso, TTL 12 h. El hub es un solo contenedor de larga
 * vida, así que un Map basta y solo se enfría tras un deploy (un refetch).
 * ponytail: si algún día hay >1 instancia o se quiere persistir el histórico,
 * mover a una tabla `stock_price` alimentada por el cron de ingesta.
 */

const TTL_MS = 12 * 60 * 60 * 1000;
const RANGE = "5d"; // ~5 cierres diarios = "la última semana"

const cache = new Map<string, { at: number; series: WeeklySeries }>();

export interface WeeklySeries {
  /** Cierres diarios viejo→nuevo, en la moneda nativa de la acción. Sin nulls. */
  closes: number[];
  /** Moneda que reporta Yahoo (para no pintar la línea de compra si no coincide). */
  currency: string;
}

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({ currency: z.string() }),
          indicators: z.object({
            quote: z.array(z.object({ close: z.array(z.number().nullable()) })).nonempty(),
          }),
        }),
      )
      .nonempty(),
  }),
});

/**
 * Símbolo IBKR + moneda → símbolo de Yahoo. US va tal cual; Hong Kong (HKD,
 * código numérico) lleva sufijo `.HK`; la cripto de IBKR (`BTC.USD-PAXOS`) es
 * `BTC-USD`. Errar esto grafica la acción equivocada, así que va bajo self-check.
 */
export function toYahooSymbol(symbol: string, currency: string): string {
  if (symbol.startsWith("BTC")) return "BTC-USD";
  if (symbol.startsWith("ETH")) return "ETH-USD";
  if (currency === "HKD" && /^\d+$/.test(symbol)) return `${symbol}.HK`;
  return symbol;
}

/** Parseo puro de la respuesta de Yahoo (sin red). Filtra nulls; null si no sirve. */
export function parseChart(json: unknown): WeeklySeries | null {
  const parsed = chartSchema.safeParse(json);
  if (!parsed.success) return null;
  const r = parsed.data.chart.result[0];
  const closes = r.indicators.quote[0].close.filter((c): c is number => c != null);
  if (closes.length < 2) return null; // una línea necesita ≥2 puntos
  return { closes, currency: r.meta.currency };
}

async function fetchOne(yahooSymbol: string): Promise<WeeklySeries | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?range=${RANGE}&interval=1d`;
  // fetch nativo de Node no cachea; el cache real es el Map de arriba.
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  return parseChart(await res.json());
}

/**
 * Serie semanal por posición, indexada por el símbolo IBKR original. Best-effort:
 * los símbolos que fallen (red, ticker raro) simplemente se omiten y su tarjeta
 * queda sin sparkline — nunca rompe la página.
 */
export async function getWeeklyCloses(
  positions: readonly { symbol: string; currency: string }[],
): Promise<Record<string, WeeklySeries>> {
  const now = Date.now();
  const out: Record<string, WeeklySeries> = {};
  await Promise.all(
    positions.map(async (p) => {
      const y = toYahooSymbol(p.symbol, p.currency);
      const hit = cache.get(y);
      if (hit && now - hit.at < TTL_MS) {
        out[p.symbol] = hit.series;
        return;
      }
      try {
        const series = await fetchOne(y);
        if (series) {
          cache.set(y, { at: now, series });
          out[p.symbol] = series;
        }
      } catch {
        // best-effort: sin sparkline para este símbolo
      }
    }),
  );
  return out;
}
