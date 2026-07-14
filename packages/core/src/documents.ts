import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema, validators } from "@hub/db";
import { z } from "zod";

/**
 * Dominio "documents" — documentos genéricos por bloques (análisis, reportes de
 * cualquier tipo con gráficos). El CONTENIDO no vive aquí: lo arma el productor
 * (un agente/skill) y lo postea por m2m; el hub persiste y renderiza. Upsert por
 * (userId, slug): re-postear el mismo slug regenera, no duplica.
 */

export type Document = typeof schema.document.$inferSelect;
export type { DocumentPayload, DocBlock, BlockTone } from "@hub/db/schema";

/** Contrato del POST m2m: lo que manda el productor (el userId lo pone el server). */
export const saveDocumentInput = validators.insertDocument
  .pick({ slug: true, kind: true, title: true, summary: true, payload: true, sourceUrl: true })
  .extend({ generatedAt: z.coerce.date() });

export type SaveDocumentInput = z.infer<typeof saveDocumentInput>;

/** Persiste un documento (upsert por (userId, slug)). */
export async function save(userId: string, input: SaveDocumentInput): Promise<void> {
  await db
    .insert(schema.document)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: [schema.document.userId, schema.document.slug],
      set: {
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        payload: input.payload,
        sourceUrl: input.sourceUrl,
        generatedAt: input.generatedAt,
      },
    });
}

/** Último documento (recientes primero), opcionalmente filtrado por `kind`. Para continuidad m2m. */
export async function getLatest(userId: string, kind?: string): Promise<Document | null> {
  const where = kind
    ? and(eq(schema.document.userId, userId), eq(schema.document.kind, kind))
    : eq(schema.document.userId, userId);
  const [row] = await db
    .select()
    .from(schema.document)
    .where(where)
    .orderBy(desc(schema.document.generatedAt))
    .limit(1);
  return row ?? null;
}

/** Un documento por slug, o null. */
export async function getBySlug(userId: string, slug: string): Promise<Document | null> {
  const [row] = await db
    .select()
    .from(schema.document)
    .where(and(eq(schema.document.userId, userId), eq(schema.document.slug, slug)));
  return row ?? null;
}

/** Documentos del usuario (recientes primero) para la lista. `kind` opcional filtra la familia. */
export function list(
  userId: string,
  opts: { kind?: string; limit?: number } = {},
): Promise<Pick<Document, "slug" | "kind" | "title" | "summary" | "generatedAt">[]> {
  const where = opts.kind
    ? and(eq(schema.document.userId, userId), eq(schema.document.kind, opts.kind))
    : eq(schema.document.userId, userId);
  return db
    .select({
      slug: schema.document.slug,
      kind: schema.document.kind,
      title: schema.document.title,
      summary: schema.document.summary,
      generatedAt: schema.document.generatedAt,
    })
    .from(schema.document)
    .where(where)
    .orderBy(desc(schema.document.generatedAt))
    .limit(opts.limit ?? 50);
}

/**
 * Dueño del hub (single-user) — mismo patrón que investments/caja.
 * ponytail: si algún día hay más usuarios, resolver por email explícito.
 */
export async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .orderBy(schema.user.createdAt)
    .limit(1);
  if (!row) {
    throw new Error("No hay usuario provisionado; entra al hub al menos una vez.");
  }
  return row.id;
}

/** Variantes m2m (sin sesión): resuelven el dueño y delegan. */
export async function saveOwnerDocument(input: SaveDocumentInput): Promise<{ userId: string }> {
  const userId = await resolveOwnerUserId();
  await save(userId, input);
  return { userId };
}

export async function getOwnerLatest(kind?: string): Promise<Document | null> {
  return getLatest(await resolveOwnerUserId(), kind);
}
