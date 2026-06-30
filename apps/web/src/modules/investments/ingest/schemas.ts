import { z } from "zod";

/**
 * Esquemas Zod de las respuestas del IBKR Client Portal Web API.
 * Validamos la ESTRUCTURA en la frontera (un campo numérico que falte o un shape
 * raro deja de pasar silenciosamente y se vuelve un error claro). IBKR manda
 * números a veces como string y a veces como number → `z.coerce.number()`.
 * Los `z.object` de Zod descartan claves desconocidas por defecto, así que no
 * rompe cuando IBKR agrega campos: solo exigimos los que consumimos.
 */

// ponytail: campos-valor opcionales que IBKR a veces omite → coerce y default 0 en el mapeo.
const num = z.coerce.number();

/** GET /portfolio/accounts */
export const AccountsResponse = z.array(z.object({ accountId: z.string() }));

/** GET /portfolio/{acct}/ledger → { USD: {...}, HKD: {...}, BASE: {...} } */
export const LedgerResponse = z.record(
  z.string(),
  z.object({ exchangerate: num.optional() }),
);

/** GET /portfolio/{acct}/positions/{page} */
export const PositionsResponse = z.array(
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

/** GET /portfolio/{acct}/summary → { netliquidation: { amount }, ... } */
export const SummaryResponse = z.record(
  z.string(),
  z.object({ amount: num.optional() }),
);
