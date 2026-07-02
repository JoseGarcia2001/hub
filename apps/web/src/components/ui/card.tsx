import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

/** Cifra de resumen. `tone` reserva verde/rojo SOLO para valor (P&L). */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
}) {
  const valueTone = tone === "pos" ? "text-up" : tone === "neg" ? "text-down" : "text-fg";
  const subTone = tone === "pos" ? "text-up" : tone === "neg" ? "text-down" : "text-muted";
  // Padding + tamaño responsivos: en móvil (grid-cols-2) una cifra COP larga como
  // "−$18.500.000" desborda con text-2xl/p-5 → text-lg/p-4 en móvil, full en sm+.
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-medium tabular-nums tracking-tight sm:text-2xl ${valueTone}`}>
        {value}
      </div>
      {sub && <div className={`mt-1 font-mono text-sm tabular-nums ${subTone}`}>{sub}</div>}
    </div>
  );
}
