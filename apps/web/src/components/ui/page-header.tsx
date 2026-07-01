import Link from "next/link";
import type { ReactNode } from "react";

/** Encabezado estándar de página: back-link opcional, título en display, acción a la derecha.
 *  Toda pantalla del hub abre con esto — una sola línea de diseño. */
export function PageHeader({
  title,
  subtitle,
  back = false,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        {back && (
          <Link href="/" className="text-sm text-muted transition hover:text-brass">
            ← Hub
          </Link>
        )}
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
