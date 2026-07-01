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
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight ${valueTone}`}>
        {value}
      </div>
      {sub && <div className={`mt-1 font-mono text-sm tabular-nums ${subTone}`}>{sub}</div>}
    </Card>
  );
}
