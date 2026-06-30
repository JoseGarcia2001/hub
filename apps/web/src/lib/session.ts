import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@hub/auth";

/** Valida la sesión en el server antes de exponer datos. Redirige a /login si no hay. */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}
