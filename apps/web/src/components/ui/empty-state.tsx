import type { ReactNode } from "react";

/** Vacío o dato ausente. `brass` para llamar la atención; `neutral` para "nada aquí". */
export function EmptyState({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "brass";
}) {
  const box = tone === "brass" ? "border-brass/40 bg-brass-dim" : "border-dashed border-line-2";
  const head = tone === "brass" ? "text-brass" : "text-fg";
  return (
    <div className={`rounded-xl border p-5 text-sm ${box}`}>
      <p className={`font-medium ${head}`}>{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}
