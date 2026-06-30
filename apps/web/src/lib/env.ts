import { z } from "zod";

/**
 * Config de entorno validada en el boot. No leer process.env disperso por el código.
 * Si una variable está mal puesta, falla acá con un mensaje claro en vez de un error
 * críptico en runtime. (DATABASE_URL y los secretos de auth los validan @hub/db y
 * @hub/auth en sus propios paquetes.)
 */
const schema = z.object({
  IBKR_CPAPI_BASE: z.url().optional().default("https://localhost:5055/v1/api"),
  IBKR_ACCOUNT_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Config de entorno inválida: ${z.prettifyError(parsed.error)}`);
}

export const env = {
  ibkr: {
    base: parsed.data.IBKR_CPAPI_BASE,
    /** Si está vacío, el adapter toma la primera cuenta de /portfolio/accounts. */
    accountId: parsed.data.IBKR_ACCOUNT_ID || undefined,
  },
} as const;
