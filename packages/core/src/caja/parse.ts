// Parser puro de las notificaciones de transacción de Rappi. SIN dependencias del
// runtime → testeable con node. Único parser del sistema: lo usan la ingesta en
// vivo (Worker → /api/caja/ingest) y el backfill histórico, por el mismo camino.
//
// La fuente se detecta por CONTENIDO (marcadores del cuerpo), no por remitente:
// al reenviar por Gmail el sobre queda con la cuenta de Gmail, no con Rappi.
import type { EmailInput, ParsedTx } from "./types";

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** "$24.789" → 24789 ; "$266.400,00" → 266400 (coma = decimales, formato CO). */
export function parseCop(s: string | null | undefined): number | null {
  if (!s) return null;
  let v = s.replace(/[^\d.,]/g, "");
  if (!v) return null;
  v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/\./g, "");
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Devuelve { fecha: 'YYYY-MM-DD'|null, hora }. Acepta ISO o "12 de junio de 2026". */
export function parseFecha(fecha: string | null | undefined, hora?: string | null): { fecha: string | null; hora: string } {
  const f = (fecha || "").trim();
  let m = f.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return { fecha: `${m[1]}-${m[2]}-${m[3]}`, hora: `${m[4]}:${m[5]}` };
  m = f.match(/(\d{1,2}) de (\w+) de (\d{4})/);
  if (m && MESES[m[2].toLowerCase()]) {
    const mo = String(MESES[m[2].toLowerCase()]).padStart(2, "0");
    const d = String(parseInt(m[1], 10)).padStart(2, "0");
    return { fecha: `${m[3]}-${mo}-${d}`, hora: (hora || "").trim() };
  }
  return { fecha: null, hora: "" };
}

export function toLines(text: string | null | undefined): string[] {
  return (text || "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Valor de la celda siguiente al primer label que matchee (Rappi maqueta label/valor en filas). */
export function field(lines: string[], ...labels: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    for (const lab of labels) {
      if (low.startsWith(lab.toLowerCase())) return lines[i + 1] ?? null;
    }
  }
  return null;
}

function parseRappicard(lines: string[]): ParsedTx | null {
  const monto = parseCop(field(lines, "Monto"));
  if (monto == null) return null;
  const { fecha, hora } = parseFecha(field(lines, "Fecha de la transacci"));
  if (!fecha) return null;
  return {
    fuente: "RappiCard", tipo: "compra", monto,
    comercio: (field(lines, "Comercio") || "").trim(),
    metodo: (field(lines, "Método de pago", "Metodo de pago") || "").trim(),
    ref: (field(lines, "No. de autorizaci", "No de autorizaci") || "").trim(),
    fecha, hora,
  };
}

function parseRappipay(lines: string[], subject: string): ParsedTx | null {
  const recibido = field(lines, "Monto recibido");
  if (recibido != null) {
    const { fecha, hora } = parseFecha(field(lines, "Fecha de la transacci"), field(lines, "Hora de la transacci"));
    const monto = parseCop(recibido);
    if (monto == null || !fecha) return null;
    return {
      fuente: "RappiPay", tipo: "transferencia_in", monto,
      comercio: (field(lines, "Banco") || "").trim(), metodo: "RappiCuenta",
      ref: (field(lines, "Nro. de transacci", "Nro de transacci") || "").trim(),
      fecha, hora,
    };
  }
  const monto = parseCop(field(lines, "Monto"));
  if (monto == null) return null;
  const tipoTx = (field(lines, "Tipo de transacci") || "").trim();
  const enviada = /envi|camino/i.test(subject || "");
  const { fecha, hora } = parseFecha(field(lines, "Fecha de la transacci"), field(lines, "Hora de la transacci"));
  if (!fecha) return null;
  return {
    fuente: "RappiPay",
    tipo: tipoTx.toUpperCase() === "PSE" ? "PSE" : enviada ? "transferencia_out" : tipoTx || "movimiento",
    monto, comercio: (field(lines, "Comercio", "Banco") || "").trim(), metodo: "RappiCuenta",
    ref: (field(lines, "CUS", "Nro. de transacci", "Nro de transacci", "Número de aprob") || "").trim(),
    fecha, hora,
  };
}

/** Punto de entrada: correo (texto plano ya extraído) → transacción cruda, o null. */
export function parse(email: EmailInput): ParsedTx | null {
  let text = email.text;
  if (!text && email.html) text = email.html.replace(/<[^>]+>/g, "\n");
  const lines = toLines(text);
  const blob = (text || "").toLowerCase();
  const subject = email.subject || "";
  if (/rappicard/.test(blob) || /rappicard/i.test(subject)) return parseRappicard(lines);
  if (/rappicuenta|rappipay|monto recibido|compra con pse/.test(blob)) return parseRappipay(lines, subject);
  return null;
}
