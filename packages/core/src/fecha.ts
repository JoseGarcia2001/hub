// Fechas como "YYYY-MM-DD" (días calendario, sin hora): aritmética en UTC para que
// el huso del proceso no corra el día.

const utc = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function addDays(ymd: string, n: number): string {
  return new Date(utc(ymd) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Días de `b` a `a` (positivo si `a` es posterior). */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(a) - utc(b)) / 86_400_000);
}

/** Hoy en Bogotá. Los vencimientos son de días colombianos, no del reloj del server. */
export function hoyBogota(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}
