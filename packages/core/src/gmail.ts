import "server-only";

// Cliente mínimo de la API de Gmail (OAuth2 refresh token + fetch, scope gmail.readonly).
// Sin las tres variables de entorno queda apagado: isConfigured() === false.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Un correo aplanado a texto: el mismo shape que manda el Worker relay. */
export type EmailInput = { subject?: string; text?: string; html?: string; messageId?: string | null };

type Creds = { clientId: string; clientSecret: string; refreshToken: string };

function creds(): Creds | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export function isConfigured(): boolean {
  return creds() !== null;
}

/** La credencial no sirve: reintentar no lo arregla, hay que regenerar el token. */
export class GmailAuthError extends Error {}

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
      // Con la app OAuth en modo Testing, Google caduca el refresh token a los 7 días.
      throw new GmailAuthError(
        "El refresh token de Gmail ya no sirve (invalid_grant). Regenerarlo y revisar que la app OAuth esté publicada en modo Production.",
      );
    }
    throw new GmailAuthError(`No pude renovar el access token de Gmail: ${detalle}`);
  }
  return body.access_token;
}

export type GmailSession = { token: string };

export async function openSession(): Promise<GmailSession> {
  const c = creds();
  if (!c) throw new GmailAuthError("Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN");
  return { token: await accessToken(c) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// La cuota de Gmail es por minuto y por usuario, compartida con cualquier otro cliente
// del mismo proyecto OAuth: se espera hasta ~1 min antes de rendirse.
const ESPERAS_CUOTA_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

async function api<T>(s: GmailSession, path: string, params: Record<string, string>): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  for (let intento = 0; ; intento++) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${s.token}` } });
    if (res.ok) return (await res.json()) as T;
    const cuota = res.status === 429 || (res.status === 403 && /rateLimitExceeded|quota/i.test(await res.text()));
    if (!cuota || intento >= ESPERAS_CUOTA_MS.length) {
      throw new Error(`Gmail ${path} devolvió HTTP ${res.status}${cuota ? " (cuota agotada)" : ""}`);
    }
    await sleep(ESPERAS_CUOTA_MS[intento]);
  }
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

const ENTIDADES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

/**
 * La API de Gmail devuelve el HTML con las tildes escapadas (el Worker no: PostalMime
 * ya decodifica). Sin esto "M&eacute;todo de pago" no casa con la etiqueta del parser.
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

/** Árbol MIME → texto plano, un dato por línea (los parsers leen etiqueta/valor por filas). */
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
    // Rappi escapa entidades también en text/plain.
    out.push(decodeEntities(raw));
  }
  for (const child of part.parts ?? []) extractText(child, out);
}

async function getEmail(s: GmailSession, id: string): Promise<EmailInput> {
  const msg = await api<Message>(s, `/messages/${id}`, { format: "full" });
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

/**
 * Baja los correos o falla entera. Nada parcial: quien la llama ingiere después, y un
 * hueco silencioso adelantaría la "última fecha" del sync por encima de los correos perdidos.
 */
export async function getEmails(s: GmailSession, ids: string[], concurrency = 4): Promise<EmailInput[]> {
  const out: EmailInput[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    for (let i = next++; i < ids.length; i = next++) out.push(await getEmail(s, ids[i]));
  });
  await Promise.all(workers);
  return out;
}
