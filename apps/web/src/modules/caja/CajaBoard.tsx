import Link from "next/link";
import { ChevronDown, TriangleAlert } from "lucide-react";
import type { caja } from "@hub/core";
import { Card, Stat, Pill } from "@/components/ui";
import { cop } from "@/lib/format";
import { CATEGORIAS, FLUJO_LABEL, mesLabel } from "./constants";
import { CorregirForm } from "./CorregirForm";

function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Barra de proporción (brass = solo proporción, no semántica de valor). */
function Bar({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-brass" style={{ width: `${pctOf(value, total)}%` }} />
    </div>
  );
}

function diaMes(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export function CajaBoard({ view }: { view: caja.MonthlyView }) {
  const { summary: s, rows, meses, mes } = view;
  // Filas que piden acción: por clasificar + consumo sin categoría (únicas por id).
  const atencion = rows.filter((r) => r.flujo === "por_clasificar" || r.categoria === "Sin categorizar");

  const egresoParts = [
    { label: "Consumo", value: s.consumo },
    { label: "Inversión", value: s.inversion },
    { label: "Pago tarjetas", value: s.pagoTarjeta },
    { label: "Por clasificar", value: s.porClasificar },
  ].filter((p) => p.value > 0);

  return (
    <div className="space-y-8">
      {/* datalist compartido por todos los correctores (se declara una sola vez) */}
      <datalist id="cat-list">
        {CATEGORIAS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Selector de mes */}
      {meses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {meses.map((m) => (
            <Link
              key={m}
              href={`/caja?mes=${m}`}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition ${
                m === mes
                  ? "bg-brass text-ink"
                  : "border border-line-2 text-muted hover:border-brass hover:text-brass"
              }`}
            >
              {mesLabel(m)}
            </Link>
          ))}
        </div>
      )}

      {/* KPIs del flujo de caja */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Ingresos" value={cop(s.ingreso)} />
        <Stat label="Egresos" value={cop(s.egresoTotal)} />
        <Stat label="Flujo neto" value={cop(s.flujoNeto)} tone={s.flujoNeto >= 0 ? "pos" : "neg"} />
        <Stat label="Consumo" value={cop(s.consumo)} sub={`${s.nConsumo} compras`} />
      </div>

      {/* Composición del egreso */}
      {egresoParts.length > 0 && (
        <Card>
          <div className="mb-4 text-sm text-muted">Composición del egreso</div>
          <div className="space-y-3">
            {egresoParts.map((p) => (
              <div key={p.label} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="font-mono tabular-nums text-muted">
                    {cop(p.value)} <span className="text-faint">· {pctOf(p.value, s.egresoTotal)}%</span>
                  </span>
                </div>
                <Bar value={p.value} total={s.egresoTotal} />
              </div>
            ))}
          </div>
          {(s.movIn > 0 || s.movOut > 0) && (
            <p className="mt-4 text-xs text-faint">
              Movimiento entre tus cuentas (neutral): +{cop(s.movIn)} / −{cop(s.movOut)}
            </p>
          )}
        </Card>
      )}

      {/* Requieren atención */}
      {atencion.length > 0 && (
        <Card className="border-brass/40 bg-brass-dim">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-brass">
            <TriangleAlert size={16} strokeWidth={1.75} />
            Requieren tu atención ({atencion.length})
          </div>
          <ul className="space-y-4">
            {atencion.map((r) => (
              <li key={r.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.comercio || "— sin comercio —"}</span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">{cop(r.monto)}</span>
                </div>
                <CorregirForm row={r} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Consumo por categoría + Top comercios */}
      {s.consumo > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 text-sm text-muted">Consumo por categoría</div>
            <div className="space-y-3">
              {s.consumoPorCategoria.map((c) => (
                <div key={c.categoria} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{c.categoria} <span className="text-faint">({c.n})</span></span>
                    <span className="font-mono tabular-nums text-muted">{cop(c.monto)}</span>
                  </div>
                  <Bar value={c.monto} total={s.consumo} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 text-sm text-muted">Top comercios (consumo)</div>
            <ul className="space-y-2.5">
              {s.topComercios.map((c) => (
                <li key={c.comercio} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{c.comercio}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted">{cop(c.monto)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Movimientos (todos) — cada fila se expande para reclasificar */}
      <div>
        <div className="mb-3 text-sm text-muted">Movimientos · {rows.length}</div>
        <Card className="overflow-hidden p-0">
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-b border-line last:border-0">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="w-14 shrink-0 font-mono text-xs text-faint">{diaMes(r.fecha)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.comercio || "—"}</span>
                      <span className="block truncate text-xs text-faint">
                        {r.categoria} · {FLUJO_LABEL[r.flujo]}
                        {r.overridden && " · editado"}
                      </span>
                    </span>
                    {r.flujo === "por_clasificar" && <Pill tone="brass">revisar</Pill>}
                    <span className="shrink-0 font-mono text-sm tabular-nums">{cop(r.monto)}</span>
                    <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-faint transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-line bg-surface-2 px-4 py-3">
                    <CorregirForm row={r} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
