"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import type { caja } from "@hub/core";
import { Card, Stat, Pill } from "@/components/ui";
import { cop } from "@/lib/format";
import { CATEGORIAS, FLUJO_LABEL, mesLabel } from "./constants";
import { CorregirForm } from "./CorregirForm";

type Metric = "neto" | "ingreso" | "egreso" | "consumo";
const METRICS: { key: Metric; label: string }[] = [
  { key: "neto", label: "Flujo neto" },
  { key: "consumo", label: "Consumo" },
  { key: "ingreso", label: "Ingresos" },
  { key: "egreso", label: "Egresos" },
];

function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
function diaMes(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

/** Gráfico de tendencia (33 meses) que ES el navegador: cada barra selecciona su mes.
 *  SVG puro, sin librerías. neto = verde/rojo por signo (valor); el resto = latón. */
function TrendChart({
  trend, metric, selected, onSelect,
}: {
  trend: caja.TrendPoint[];
  metric: Metric;
  selected: string;
  onSelect: (mes: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // arranca mostrando lo más reciente (derecha)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);

  const slot = 26, barW = 13, H = 150, padTop = 16, padBot = 24;
  const chartH = H - padTop - padBot;
  const vals = trend.map((t) => t[metric]);
  const maxAbs = Math.max(1, ...vals.map((v) => Math.abs(v)));
  const hasNeg = vals.some((v) => v < 0);
  const zeroY = hasNeg ? padTop + chartH / 2 : H - padBot;
  const scale = (hasNeg ? chartH / 2 : chartH) / maxAbs;
  const width = trend.length * slot;

  const color = (v: number) =>
    metric === "neto" ? (v >= 0 ? "var(--up)" : "var(--down)")
    : metric === "ingreso" ? "var(--up)"
    : metric === "egreso" ? "var(--down)"
    : "var(--brass)";

  return (
    <div ref={scroller} className="overflow-x-auto">
      <svg width={width} height={H} className="block" role="img" aria-label="Tendencia mensual">
        {hasNeg && <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--line-2)" strokeWidth={1} />}
        {trend.map((t, i) => {
          const v = t[metric];
          const h = Math.max(Math.abs(v) * scale, 1);
          const x = i * slot + (slot - barW) / 2;
          const y = v >= 0 ? zeroY - h : zeroY;
          const isSel = t.mes === selected;
          const jan = t.mes.endsWith("-01");
          return (
            <g key={t.mes} onClick={() => onSelect(t.mes)} className="cursor-pointer">
              <title>{`${mesLabel(t.mes)}: ${cop(v)}`}</title>
              <rect
                x={x} y={y} width={barW} height={h} rx={2}
                fill={color(v)} opacity={isSel ? 1 : 0.5}
                stroke={isSel ? "var(--brass-bright)" : "none"} strokeWidth={isSel ? 2 : 0}
              />
              {/* área de click de toda la columna */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {jan && (
                <text x={i * slot + slot / 2} y={H - 8} textAnchor="middle" style={{ fill: "var(--faint)" }} fontSize={10}>
                  {t.mes.slice(0, 4)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Bar({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-brass" style={{ width: `${pctOf(value, total)}%` }} />
    </div>
  );
}

export function CajaBoard({ overview }: { overview: caja.Overview }) {
  const { meses, trend, months } = overview;
  const [mes, setMes] = useState(meses[0]);
  const [metric, setMetric] = useState<Metric>("neto");

  const data = months[mes] ?? months[meses[0]];
  const s = data.summary;
  const idx = meses.indexOf(data.mes);
  const atencion = data.rows.filter((r) => r.flujo === "por_clasificar" || r.categoria === "Sin categorizar");
  const egresoParts = [
    { label: "Consumo", value: s.consumo },
    { label: "Inversión", value: s.inversion },
    { label: "Pago tarjetas", value: s.pagoTarjeta },
    { label: "Por clasificar", value: s.porClasificar },
  ].filter((p) => p.value > 0);

  return (
    <div className="space-y-6">
      <datalist id="cat-list">
        {CATEGORIAS.map((c) => <option key={c} value={c} />)}
      </datalist>

      {/* Tendencia + navegador */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted">Tendencia · {trend.length} meses</span>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  metric === m.key ? "bg-brass text-ink" : "border border-line-2 text-muted hover:border-brass hover:text-brass"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart trend={trend} metric={metric} selected={data.mes} onSelect={setMes} />
      </Card>

      {/* Stepper del mes seleccionado */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => idx < meses.length - 1 && setMes(meses[idx + 1])}
          disabled={idx >= meses.length - 1}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-2 text-muted transition hover:border-brass hover:text-brass disabled:opacity-30 disabled:hover:border-line-2 disabled:hover:text-muted"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <div className="text-center">
          <div className="font-display text-xl font-bold capitalize">{mesLabel(data.mes)}</div>
          <div className={`font-mono text-sm tabular-nums ${s.flujoNeto >= 0 ? "text-up" : "text-down"}`}>
            Flujo neto {cop(s.flujoNeto)}
          </div>
        </div>
        <button
          onClick={() => idx > 0 && setMes(meses[idx - 1])}
          disabled={idx <= 0}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-2 text-muted transition hover:border-brass hover:text-brass disabled:opacity-30 disabled:hover:border-line-2 disabled:hover:text-muted"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      {/* KPIs */}
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

      {/* Movimientos — cada fila se expande para reclasificar */}
      <div>
        <div className="mb-3 text-sm text-muted">Movimientos · {data.rows.length}</div>
        <Card className="overflow-hidden p-0">
          <ul>
            {data.rows.map((r) => (
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
