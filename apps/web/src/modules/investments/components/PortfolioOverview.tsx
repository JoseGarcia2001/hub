import { Card, Stat } from "@/components/ui/card";
import { money, pct } from "@/lib/format";
import type { PortfolioSnapshot } from "../ingest/types";

export function PortfolioOverview({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { netLiquidation, cash, positionsValue, unrealizedPnl, unrealizedPnlPct, positions } = snapshot;
  const pnlTone = unrealizedPnl >= 0 ? "pos" : "neg";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Patrimonio (NAV)" value={money(netLiquidation)} />
        <Stat label="Posiciones" value={money(positionsValue)} />
        <Stat label="Efectivo" value={money(cash)} sub={cash > netLiquidation * 0.1 ? "sin invertir" : undefined} />
        <Stat label="P&L no realizado" value={money(unrealizedPnl)} sub={pct(unrealizedPnlPct)} tone={pnlTone} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500 border-b border-black/10 dark:border-white/10">
              <tr>
                <th className="p-3 font-medium">Símbolo</th>
                <th className="p-3 font-medium text-right">Cant.</th>
                <th className="p-3 font-medium text-right">Costo (USD)</th>
                <th className="p-3 font-medium text-right">Valor (USD)</th>
                <th className="p-3 font-medium text-right">Peso</th>
                <th className="p-3 font-medium text-right">P&L (USD / %)</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const tone = p.unrealizedPnlBase >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                const pnlPct = p.costBasisBase ? (p.unrealizedPnlBase / p.costBasisBase) * 100 : 0;
                return (
                  <tr key={p.conid} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="p-3 font-medium">
                      {p.symbol}
                      {p.currency !== "USD" && <span className="ml-1 text-xs text-neutral-400">{p.currency}</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{p.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}</td>
                    <td className="p-3 text-right tabular-nums text-neutral-500">{money(p.costBasisBase)}</td>
                    <td className="p-3 text-right tabular-nums">{money(p.marketValueBase)}</td>
                    <td className="p-3 text-right tabular-nums text-neutral-500">{p.weightPct.toFixed(1)}%</td>
                    <td className={`p-3 text-right tabular-nums ${tone}`}>
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

      <p className="text-xs text-neutral-400">
        Fuente: IBKR Client Portal Web API · cuenta {snapshot.accountId} · {new Date(snapshot.asOf).toLocaleString("es-CO")}
      </p>
    </div>
  );
}
