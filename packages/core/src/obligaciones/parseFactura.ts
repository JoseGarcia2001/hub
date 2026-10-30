// Parser puro de facturas de servicios. La fuente se detecta por CONTENIDO: al
// reenviar por Gmail el remitente se pierde. Agregar un proveedor = otra entrada en PARSERS.
import { fechaMesAbreviado, field, pesosEnteros, toLines } from "../texto";
import type { EmailInput, ParsedFactura } from "./types";

type ProviderParser = {
  proveedorKey: string;
  detect: (blob: string) => boolean;
  extract: (lines: string[], blob: string) => ParsedFactura | null;
};

const ENEL: ProviderParser = {
  proveedorKey: "enel",
  detect: (blob) => /enel/.test(blob) && /(total a pagar|pago oportuno|n[uú]mero de cliente)/.test(blob),
  extract: (lines, blob) => {
    const monto = pesosEnteros(field(lines, "Tu total a pagar", "Total a pagar"));
    const fechaVencimiento = fechaMesAbreviado(field(lines, "Pago oportuno"));
    if (monto == null || !fechaVencimiento) return null;
    const emiMatch = blob.match(/fecha:\s*(\d{1,2}\s*[a-záéíóú]{3}\s*\/?\s*\d{4})/i);
    const fechaEmision = fechaMesAbreviado(emiMatch?.[1]);
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
