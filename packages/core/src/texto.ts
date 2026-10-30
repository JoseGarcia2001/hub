// Lectura de correos maquetados como filas etiqueta/valor (Rappi, ENEL). Puro, sin runtime.

export function toLines(text: string | null | undefined): string[] {
  return (text || "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Línea siguiente a la primera que empiece por alguna de las etiquetas. */
export function field(lines: string[], ...labels: string[]): string | null {
  const wanted = labels.map((l) => l.toLowerCase());
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    if (wanted.some((lab) => low.startsWith(lab))) return lines[i + 1] ?? null;
  }
  return null;
}

/** Pesos enteros escritos con punto o coma de miles: "$148.730", "$181,070", "$294660". */
export function pesosEnteros(s: string | null | undefined): number | null {
  const digits = (s || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : null;
}

const MESES_ABREV: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/** "26 JUN/2026", "10 JUL /2026", "15 Oct. 2026" (mes en español o inglés) → "YYYY-MM-DD". */
export function fechaMesAbreviado(s: string | null | undefined): string | null {
  const m = (s || "").match(/(\d{1,2})\s*([A-Za-zÁÉÍÓÚáéíóú]{3})[A-Za-z]*\.?\s*\/?\s*(\d{4})/);
  const mes = m ? MESES_ABREV[m[2].toLowerCase()] : undefined;
  if (!m || !mes) return null;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
