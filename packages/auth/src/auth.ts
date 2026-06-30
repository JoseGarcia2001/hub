import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db, schema } from "@hub/db";

/** Single-user: solo los correos de esta lista pueden tener cuenta. */
const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  // Alternativa a Google: correo + contraseña, SOLO sign-in.
  // disableSignUp cierra el registro público: sin él, cualquiera que conozca un
  // correo del allowlist podría registrarlo primero con su propia contraseña y
  // apropiarse de la cuenta (el allowlist permite el correo, no verifica identidad).
  // Las cuentas se provisionan fuera de banda. Google sí puede crear cuenta (verifica
  // identidad), gateado por el allowlist de abajo.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  databaseHooks: {
    user: {
      create: {
        // Cierra la puerta para cualquier proveedor (Google o email/password): si el correo
        // no está en el allowlist, no se crea la cuenta. Login de cuentas ya
        // existentes no pasa por aquí, así que solo bloquea altas no autorizadas.
        before: async (user) => {
          if (
            ALLOWED_EMAILS.length > 0 &&
            !ALLOWED_EMAILS.includes(user.email.toLowerCase())
          ) {
            throw new APIError("FORBIDDEN", { message: "Cuenta no autorizada." });
          }
          return { data: user };
        },
      },
    },
  },
});
