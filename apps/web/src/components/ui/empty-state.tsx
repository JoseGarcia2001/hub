import type { ReactNode } from "react";

/** Vacío o dato ausente. `brass` para llamar la atención; `neutral` para "nada aquí".
 *  `icon` opcional: pasar un icono de lucide-react (nunca un emoji). */
export function EmptyState({
  title,
  children,
  tone = "neutral",
  icon,
}: {
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "brass";
  icon?: ReactNode;
}) {
  const box = tone === "brass" ? "border-brass/40 bg-brass-dim" : "border-dashed border-line-2";
  const head = tone === "brass" ? "text-brass" : "text-fg";
  return (
    <div className={`rounded-xl border p-5 text-sm ${box}`}>
      {icon && <div className={`mb-2 ${tone === "brass" ? "text-brass" : "text-faint"}`}>{icon}</div>}
      <p className={`font-medium ${head}`}>{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}
