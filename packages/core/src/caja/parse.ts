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

// Meses abreviados del comprobante de pago de servicios: viene en inglés ("15 Oct. 2026")
// o en español ("26 Ago. 2025") según la plantilla.
const MESES_ABREV: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/** "14:40 hrs, 15 Oct. 2026" → { fecha: "2026-10-15", hora: "14:40" }. */
export function parseFechaServicio(s: string | null | undefined): { fecha: string | null; hora: string } {
  const m = (s || "").match(/(?:(\d{1,2}:\d{2})\s*hrs,?\s*)?(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  const mes = m ? MESES_ABREV[m[3].toLowerCase()] : undefined;
  if (!m || !mes) return { fecha: null, hora: "" };
  return { fecha: `${m[4]}-${String(mes).padStart(2, "0")}-${m[2].padStart(2, "0")}`, hora: m[1] ?? "" };
}

/**
 * "RappiPay - Resumen de Pago a Servicio" (ENEL, Vanti, EAAB… pagados con tarjeta vía
 * Puntored). No llega un correo de RappiCard aparte por el cargo, así que esta es la
 * única huella del pago. Montos SIN decimales y con coma de miles ("$181,070") o sin
 * separador ("$294660") → aquí la coma NO es decimal, a diferencia del PSE.
 * `ref` = referencia de pago (cuenta-contrato): lo que casa el pago con su obligación.
 */
function parsePagoServicio(lines: string[]): ParsedTx | null {
  const montoRaw = field(lines, "Pago total", "Monto de recibo");
  const digits = (montoRaw || "").replace(/[^\d]/g, "");
  const monto = digits ? parseInt(digits, 10) : null;
  const { fecha, hora } = parseFechaServicio(field(lines, "Fecha y hora"));
  if (monto == null || !fecha) return null;
  return {
    fuente: "RappiPay", tipo: "pago_servicio", monto,
    comercio: (field(lines, "Convenio", "Nombre del servicio") || "").trim(),
    metodo: (field(lines, "Método de pago", "Metodo de pago") || "").trim(),
    ref: (field(lines, "Referencia") || "").trim(),
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
  // Antes que RappiPay genérico: su "Monto de recibo" con coma de miles se leería como decimal.
  if (/pago a servicio/i.test(subject) || /tipo de transacci[oó]n\s+pago de servicio/.test(blob.replace(/\s+/g, " "))) {
    return parsePagoServicio(lines);
  }
  if (/rappicard/.test(blob) || /rappicard/i.test(subject)) return parseRappicard(lines);
  if (/rappicuenta|rappipay|monto recibido|compra con pse/.test(blob)) return parseRappipay(lines, subject);
  return null;
}
