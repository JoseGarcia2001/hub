import "server-only";
import { db, schema } from "@hub/db";

/** El hub es single-user: el dueño es el primer usuario provisionado. */
export async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .orderBy(schema.user.createdAt)
    .limit(1);
  if (!row) throw new Error("No hay usuario provisionado; entra al hub al menos una vez.");
  return row.id;
}
