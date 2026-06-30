import "server-only";
import { z } from "zod";

/**
 * Config de las fuentes de inversiones, validada en el boot. Todo opcional: el
 * hub arranca sin IBKR configurado (la página solo lee de la DB). Una fuente
 * falla con error "config" si le falta lo suyo cuando de verdad se usa (ingesta).
 *
 * - Flex (headless, recomendada para el cron): token + queryId.
 * - cp-rest (gateway local, para refrescar desde el Mac): base + accountId.
 */
const schema = z.object({
  INVESTMENTS_SOURCE: z.enum(["flex", "cp-rest"]).optional().default("flex"),
  IBKR_FLEX_TOKEN: z.string().optional(),
  IBKR_FLEX_QUERY_ID: z.string().optional(),
  IBKR_CPAPI_BASE: z.url().optional().default("https://localhost:5055/v1/api"),
  IBKR_ACCOUNT_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Config de inversiones inválida: ${z.prettifyError(parsed.error)}`);
}

export const config = {
  source: parsed.data.INVESTMENTS_SOURCE,
  flex: {
    token: parsed.data.IBKR_FLEX_TOKEN,
    queryId: parsed.data.IBKR_FLEX_QUERY_ID,
  },
  cp: {
    base: parsed.data.IBKR_CPAPI_BASE,
    accountId: parsed.data.IBKR_ACCOUNT_ID || undefined,
  },
} as const;
