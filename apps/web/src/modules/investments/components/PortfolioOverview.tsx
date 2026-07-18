import type { investments } from "@hub/core";
import { Card, Stat } from "@/components/ui";
import { money, pct, since } from "@/lib/format";

type Weekly = Record<string, investments.WeeklySeries>;

export function PortfolioOverview({
  snapshot,
  weekly,
}: {
  snapshot: investments.StoredSnapshot;
  weekly: Weekly;
}) {
  const { netLiquidation, cash, positionsValue, unrealizedPnl, unrealizedPnlPct, positions } = snapshot;
  const pnlTone = unrealizedPnl >= 0 ? "pos" : "neg";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Patrimonio (NAV)" value={money(netLiquidation)} />
        <Stat label="Posiciones" value={money(positionsValue)} />
        <Stat label="Efectivo" value={money(cash)} sub={cash > netLiquidation * 0.1 ? "sin invertir" : undefined} />
        <Stat label="P&L no realizado" value={money(unrealizedPnl)} sub={pct(unrealizedPnlPct)} tone={pnlTone} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((p) => (
          <PositionCard key={p.conid} p={p} series={weekly[p.symbol]} />
        ))}
      </div>

      <p className="text-xs text-faint">
        Fuente: IBKR ({snapshot.source}) · cuenta {snapshot.accountId} · actualizado {since(snapshot.asOf)}{" "}
        ({new Date(snapshot.asOf).toLocaleString("es-CO")}). Precios semanales: Yahoo Finance (cierres diarios).
      </p>
    </div>
  );
}

function PositionCard({
  p,
  series,
}: {
  p: investments.StoredSnapshot["positions"][number];
  series?: investments.WeeklySeries;
}) {
  const pnlTone = p.unrealizedPnlBase >= 0 ? "text-up" : "text-down";
  const pnlPct = p.costBasisBase ? (p.unrealizedPnlBase / p.costBasisBase) * 100 : 0;

  const closes = series?.closes;
  const weekPct =
    closes && closes.length >= 2 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : null;
  const weekTone = weekPct == null ? "text-faint" : weekPct >= 0 ? "text-up" : "text-down";

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold">{p.symbol}</span>
            {p.currency !== "USD" && <span className="font-mono text-xs text-faint">{p.currency}</span>}
          </div>
          <div className="truncate text-xs text-muted">{p.name}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-mono text-sm tabular-nums ${weekTone}`}>
            {weekPct == null ? "—" : pct(weekPct)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-faint">7 días</div>
        </div>
      </div>

      {series ? (
        <Sparkline series={series} symbol={p.symbol} avgCost={p.avgCost} nativeCurrency={p.currency} />
      ) : (
        <div className="grid h-9 place-items-center text-xs text-faint">sin precios</div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-sm">
        <Field label="Precio" value={money(p.marketPrice, p.currency)} />
        <Field label="Tu costo" value={money(p.avgCost, p.currency)} align="right" tone="muted" />
        <Field label="Valor (USD)" value={money(p.marketValueBase)} />
        <div className="text-right">
          <div className="text-xs text-faint">P&L · {p.weightPct.toFixed(1)}%</div>
          <div className={`font-mono tabular-nums ${pnlTone}`}>
            {money(p.unrealizedPnlBase)} <span className="text-xs">{pct(pnlPct)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  align = "left",
  tone = "fg",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
  tone?: "fg" | "muted";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-xs text-faint">{label}</div>
      <div className={`font-mono tabular-nums ${tone === "muted" ? "text-muted" : ""}`}>{value}</div>
    </div>
  );
}

/**
 * Sparkline de la semana (SVG a mano, sin librería — como el resto de gráficos del
 * hub). Línea punteada en el precio de compra (`avgCost`), solo si Yahoo reporta la
 * misma moneda nativa que la posición (evita comparar HKD contra USD). El dominio Y
 * incluye el avgCost para que la referencia siempre quede en cuadro.
 */
function Sparkline({
  series,
  symbol,
  avgCost,
  nativeCurrency,
}: {
  series: investments.WeeklySeries;
  symbol: string;
  avgCost: number;
  nativeCurrency: string;
}) {
  const W = 100;
  const H = 36;
  const pad = 3;
  const { closes } = series;
  const showAvg = series.currency === nativeCurrency;

  const domain = showAvg ? [...closes, avgCost] : closes;
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (closes.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);

  const line = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  const up = closes[closes.length - 1] >= closes[0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-9 w-full"
      role="img"
      aria-label={`Precio de ${symbol}, últimos ${closes.length} cierres`}
    >
      {showAvg && (
        <line
          x1={0}
          x2={W}
          y1={y(avgCost)}
          y2={y(avgCost)}
          className="stroke-faint"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={line}
        fill="none"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={up ? "stroke-up" : "stroke-down"}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
