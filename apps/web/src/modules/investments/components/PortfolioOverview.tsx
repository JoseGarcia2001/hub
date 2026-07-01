import type { investments } from "@hub/core";
import { Card, Stat } from "@/components/ui";
import { money, pct, since } from "@/lib/format";

export function PortfolioOverview({ snapshot }: { snapshot: investments.StoredSnapshot }) {
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

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line-2 text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="p-3 font-medium">Símbolo</th>
                <th className="p-3 text-right font-medium">Cant.</th>
                <th className="p-3 text-right font-medium">Costo (USD)</th>
                <th className="p-3 text-right font-medium">Valor (USD)</th>
                <th className="p-3 text-right font-medium">Peso</th>
                <th className="p-3 text-right font-medium">P&L (USD / %)</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const tone = p.unrealizedPnlBase >= 0 ? "text-up" : "text-down";
                const pnlPct = p.costBasisBase ? (p.unrealizedPnlBase / p.costBasisBase) * 100 : 0;
                return (
                  <tr key={p.conid} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="p-3 font-semibold">
                      {p.symbol}
                      {p.currency !== "USD" && (
                        <span className="ml-1 font-mono text-xs text-faint">{p.currency}</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      {p.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-muted">{money(p.costBasisBase)}</td>
                    <td className="p-3 text-right font-mono tabular-nums">{money(p.marketValueBase)}</td>
                    <td className="p-3 text-right font-mono tabular-nums text-muted">{p.weightPct.toFixed(1)}%</td>
                    <td className={`p-3 text-right font-mono tabular-nums ${tone}`}>
                      <div>{money(p.unrealizedPnlBase)}</div>
                      <div className="text-xs">{pct(pnlPct)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-faint">
        Fuente: IBKR ({snapshot.source}) · cuenta {snapshot.accountId} · actualizado {since(snapshot.asOf)}{" "}
        ({new Date(snapshot.asOf).toLocaleString("es-CO")})
      </p>
    </div>
  );
}
