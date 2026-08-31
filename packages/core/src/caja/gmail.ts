import "server-only";
import type { EmailInput } from "./types";

/**
 * Cliente mínimo de la API de Gmail para el *pull* de caja.
 *
 * Por qué existe: el Worker de Cloudflare empuja cada correo al hub, pero si el
 * server está apagado ese POST se pierde sin reintento (ago-2026: 165 transacciones
 * perdidas en tres ventanas de apagado). Gmail YA es una cola durable con retención
 * infinita, así que en vez de montar otra cola, el hub va y pregunta "¿qué me falta?".
 * El Worker sigue dando tiempo real; esto es la red de seguridad que converge sola.
 *
 * Sin dependencias nuevas: OAuth2 refresh-token + fetch. Scope `gmail.readonly`.
 * Sin las tres variables de entorno el feature se apaga con gracia (isConfigured()).
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Los remitentes de Rappi. Migraron de dominio en 2025; el formato del correo no cambió. */
export const QUERY_REMITENTES = "from:(rappicard.co OR rappipay.co OR rappi.nreply@rappi.com)";

type Creds = { clientId: string; clientSecret: string; refreshToken: string };

function creds(): Creds | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

/** ¿Están las credenciales? Si no, el sync no corre y el endpoint lo dice sin romperse. */
export function isConfigured(): boolean {
  return creds() !== null;
}

export class GmailAuthError extends Error {}

/**
 * Access token de corta vida a partir del refresh token.
 * `invalid_grant` aquí significa que el refresh token murió: la app OAuth quedó en
 * modo *Testing* (Google los caduca a los 7 días), Jose cambió la contraseña, o
 * revocó el acceso. Se distingue con su propio error para que el reconciliador
 * alerte con un mensaje accionable en vez de un 502 genérico.
 */
async function accessToken(c: Creds): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) {
    const detalle = body.error || `HTTP ${res.status}`;
    if (detalle === "invalid_grant") {
      throw new GmailAuthError(
        "El refresh token de Gmail ya no sirve (invalid_grant). Regenerarlo y revisar que la app OAuth esté publicada en modo Production.",
      );
    }
    throw new GmailAuthError(`No pude renovar el access token de Gmail: ${detalle}`);
  }
  return body.access_token;
}

/** Sesión con token ya resuelto: lo pedimos una vez por corrida, no por mensaje. */
export type GmailSession = { token: string };

export async function openSession(): Promise<GmailSession> {
  const c = creds();
  if (!c) throw new GmailAuthError("Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN");
  return { token: await accessToken(c) };
}

async function api<T>(s: GmailSession, path: string, params: Record<string, string>): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${s.token}` } });
  if (!res.ok) throw new Error(`Gmail ${path} devolvió HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Todos los ids del query, paginando hasta agotar. `cap` frena una ventana absurda. */
export async function listMessageIds(s: GmailSession, query: string, cap = 5000): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = { q: query, maxResults: "500" };
    if (pageToken) params.pageToken = pageToken;
    const page = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(s, "/messages", params);
    for (const m of page.messages ?? []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < cap);
  return ids;
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type Message = { payload: Part & { headers: { name: string; value: string }[] } };

/** Entidades nombradas que aparecen en los correos de Rappi (español). Las numéricas
 *  se resuelven aparte, sin tabla. */
const ENTIDADES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

/**
 * Decodifica entidades HTML. El Worker no necesita esto (PostalMime ya entrega el
 * texto decodificado), pero la API de Gmail devuelve el HTML crudo: sin decodificar,
 * `M&eacute;todo de pago` no matchea el label "Método de pago" del parser y el campo
 * `metodo` se guardaría vacío. El backfill en Python usaba html.unescape; esta es
 * su contraparte, sin dependencias.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTIDADES[body] ?? match;
  });
}

/** Aplana el árbol MIME a texto plano. El hub re-tokeniza después, así que solo
 *  importa que cada dato quede en su propia línea (igual que hace el Worker). */
function extractText(part: Part, out: string[]): void {
  const data = part.body?.data;
  const mime = part.mimeType ?? "";
  if (data && mime.startsWith("text/")) {
    let raw = Buffer.from(data, "base64url").toString("utf8");
    if (mime.includes("html")) {
      raw = raw
        .replace(/<(style|head|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, "\n");
    }
    // También en text/plain: Rappi manda las entidades escapadas en ambas partes.
    out.push(decodeEntities(raw));
  }
  for (const child of part.parts ?? []) extractText(child, out);
}

/** Un mensaje → el mismo shape que manda el Worker, para que el dedupe sea consistente. */
export async function getEmail(s: GmailSession, id: string): Promise<EmailInput | null> {
  let msg: Message;
  try {
    msg = await api<Message>(s, `/messages/${id}`, { format: "full" });
  } catch {
    return null; // un mensaje ilegible no puede tumbar la corrida completa
  }
  const headers = new Map(msg.payload.headers.map((h) => [h.name.toLowerCase(), h.value]));
  const chunks: string[] = [];
  extractText(msg.payload, chunks);
  const text = chunks
    .join("\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return {
    subject: headers.get("subject") ?? "",
    text,
    messageId: headers.get("message-id") ?? null,
  };
}

/** Baja los correos con concurrencia acotada (la API de Gmail tiene cuota por segundo). */
export async function getEmails(s: GmailSession, ids: string[], concurrency = 8): Promise<EmailInput[]> {
  const out: EmailInput[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    for (let i = next++; i < ids.length; i = next++) {
      const email = await getEmail(s, ids[i]);
      if (email) out.push(email);
    }
  });
  await Promise.all(workers);
  return out;
}
