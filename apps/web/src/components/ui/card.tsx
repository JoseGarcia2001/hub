import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  const toneClass = tone === "pos" ? "text-emerald-600 dark:text-emerald-400" : tone === "neg" ? "text-red-600 dark:text-red-400" : "";
  return (
    <Card>
      <div className="text-sm text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className={`mt-1 text-sm tabular-nums ${toneClass}`}>{sub}</div>}
    </Card>
  );
}
