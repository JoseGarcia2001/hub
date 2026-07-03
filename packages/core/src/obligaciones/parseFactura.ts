// Parser puro de facturas de servicios. SIN dependencias del runtime → testeable.
// Hoy: ENEL (factura digital con total + "pago oportuno", verificado con el correo real).
// Extensible: agregar un proveedor = otra entrada en PARSERS. La fuente se detecta por
// CONTENIDO (al reenviar por Gmail el remitente se pierde).
//
// ponytail: `parseCop` se duplica de caja/parse.ts (5 líneas) en vez de acoplar dominios.
import type { EmailInput, ParsedFactura } from "./types";

const MESES_ABREV: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** "$148.730" → 148730 ; "$176,160" → 176160 (punto o coma = miles en estos correos). */
function parseCop(s: string | null | undefined): number | null {
  if (!s) return null;
  const v = s.replace(/[^\d]/g, "");
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** "26 JUN/2026" | "10 JUL /2026" → "2026-06-26". */
function parseFechaAbrev(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\s*([A-Za-zÁÉÍÓÚáéíóú]{3})\s*\/?\s*(\d{4})/);
  if (!m) return null;
  const mes = MESES_ABREV[m[2].toLowerCase()];
  if (!mes) return null;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
}

function toLines(text: string | null | undefined): string[] {
  return (text || "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Valor de la línea siguiente al primer label que empiece igual (label/valor en filas). */
function afterLabel(lines: string[], ...labels: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    for (const lab of labels) if (low.startsWith(lab.toLowerCase())) return lines[i + 1] ?? null;
  }
  return null;
}

type ProviderParser = {
  proveedorKey: string;
  detect: (blob: string) => boolean;
  extract: (lines: string[], blob: string) => ParsedFactura | null;
};

const ENEL: ProviderParser = {
  proveedorKey: "enel",
  detect: (blob) => /enel/.test(blob) && /(total a pagar|pago oportuno|n[uú]mero de cliente)/.test(blob),
  extract: (lines, blob) => {
    const monto = parseCop(afterLabel(lines, "Tu total a pagar", "Total a pagar"));
    const fechaVencimiento = parseFechaAbrev(afterLabel(lines, "Pago oportuno"));
    if (monto == null || !fechaVencimiento) return null;
    const emiMatch = blob.match(/fecha:\s*(\d{1,2}\s*[a-záéíóú]{3}\s*\/?\s*\d{4})/i);
    const fechaEmision = parseFechaAbrev(emiMatch?.[1]) ?? null;
    const cuentaMatch = blob.match(/n[uú]mero de cliente\s*([\d]+\s*-?\s*\d?)/i);
    const cuentaContrato = cuentaMatch ? cuentaMatch[1].replace(/\s+/g, "") : null;
    // Período = mes de emisión (la "factura de junio"); si no hay emisión, el mes del vencimiento.
    const periodo = (fechaEmision ?? fechaVencimiento).slice(0, 7);
    return { proveedorKey: "enel", cuentaContrato, periodo, monto, fechaEmision, fechaVencimiento };
  },
};

const PARSERS: ProviderParser[] = [ENEL];

/** Correo de factura → factura parseada, o null si no reconoce el proveedor/forma. */
export function parseFactura(email: EmailInput): ParsedFactura | null {
  let text = email.text;
  if (!text && email.html) text = email.html.replace(/<[^>]+>/g, "\n");
  const lines = toLines(text);
  const blob = ((text || "") + " " + (email.subject || "")).toLowerCase();
  for (const p of PARSERS) if (p.detect(blob)) return p.extract(lines, blob);
  return null;
}
