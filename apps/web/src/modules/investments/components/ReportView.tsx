import Link from "next/link";
import { CalendarDays, ExternalLink } from "lucide-react";
import type { reports } from "@hub/core";
import { Card, Pill, Stat } from "@/components/ui";
import { money, pct, since } from "@/lib/format";

/**
 * Render del informe semanal de inversiones. Server component puro: pinta el
 * `payload` estructurado que posteó el agente asesor — el hub no re-analiza nada.
 */

const ACTION_LABEL: Record<string, string> = {
  MANTENER: "Mantener",
  VIGILAR: "Vigilar",
  ANALIZAR: "Analizar a fondo",
  CONSIDERAR_VENTA: "Considerar venta",
  CONSIDERAR_COMPRA: "Considerar compra",
};

function actionTone(action: string): "brass" | "ghost" | "soon" {
  if (action === "MANTENER") return "ghost";
  if (action === "VIGILAR") return "soon";
  return "brass";
}

export function ReportView({ report }: { report: reports.InvestmentReport }) {
  const p = report.payload;
  const delta = p.portfolio.weekDelta;

  return (
    <div className="space-y-6">
      {/* TL;DR — el resumen antes que el detalle */}
      <Card>
        <h2 className="font-display text-lg font-semibold">En resumen</h2>
        <ul className="mt-3 space-y-2">
          {p.tldr.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
              {line}
            </li>
          ))}
        </ul>
      </Card>

      {/* Cifras del portafolio */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="NAV"
          value={money(p.portfolio.nav)}
          sub={delta ? `${pct(delta.navPct)} sem.` : undefined}
          tone={delta ? (delta.navPct >= 0 ? "pos" : "neg") : undefined}
        />
        <Stat label="Efectivo" value={money(p.portfolio.cash)} />
        <Stat label="Posiciones" value={money(p.portfolio.positionsValue)} />
        <Stat
          label="P&L no realizado"
          value={money(p.portfolio.unrealizedPnl)}
          sub={pct(p.portfolio.unrealizedPnlPct)}
          tone={p.portfolio.unrealizedPnl >= 0 ? "pos" : "neg"}
        />
      </section>

      {/* Movers + concentración */}
      {(p.portfolio.topMovers.length > 0 || p.portfolio.concentration.flags.length > 0) && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {p.portfolio.topMovers.map((m) => (
              <Pill key={m.symbol} tone={m.weekPct >= 0 ? "up" : "down"}>
                <span className="font-mono tabular-nums">
                  {m.symbol} {pct(m.weekPct)}
                </span>
              </Pill>
            ))}
          </div>
          {p.portfolio.concentration.flags.length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-muted">
              {p.portfolio.concentration.flags.map((f, i) => (
                <p key={i}>{f}</p>
              ))}
              <p className="text-xs text-faint">
                Top 3 = {p.portfolio.concentration.top3Pct.toFixed(1)}% del portafolio
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Tesis cripto */}
      {p.crypto && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Tesis cripto</h2>
          <p className="mt-1 text-sm text-muted">{p.crypto.windowNote}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {p.crypto.assets.map((a) => (
              <div key={a.symbol} className="rounded-lg border border-line bg-surface-2 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{a.symbol}</span>
                  <span className="font-mono text-lg tabular-nums">{money(a.price)}</span>
                </div>
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {a.levels.map((l) => (
                      <tr key={l.level} className="border-t border-line">
                        <td className="py-1.5 pr-2 text-muted">{l.label}</td>
                        <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                          {money(l.level, "USD", 0)}
                        </td>
                        <td className="py-1.5 text-right font-mono text-xs tabular-nums text-faint">
                          {l.crossedThisWeek ? <Pill tone="brass">cruzado</Pill> : pct(l.distancePct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Novedades materiales */}
      <Card>
        <h2 className="font-display text-lg font-semibold">Novedades materiales</h2>
        {p.companies.length > 0 ? (
          <div className="mt-3 space-y-4">
            {p.companies.map((c, i) => (
              <article key={i} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="brass">{c.symbol}</Pill>
                  <h3 className="font-semibold">{c.headline}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.why}</p>
                <p className="mt-1 text-sm leading-relaxed">{c.thesisImpact}</p>
                <a
                  href={c.source}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-brass transition hover:text-brass-bright"
                >
                  <ExternalLink size={12} strokeWidth={1.75} />
                  Fuente
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Ninguna esta semana — eso también es información.</p>
        )}
        {p.noNews.length > 0 && (
          <p className="mt-4 border-t border-line pt-3 text-xs text-faint">
            Sin novedades materiales: {p.noNews.join(", ")}
          </p>
        )}
      </Card>

      {/* Recomendaciones del asesor */}
      {p.recommendations.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Recomendaciones</h2>
          <div className="mt-3 space-y-4">
            {p.recommendations.map((r, i) => (
              <div key={i} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={actionTone(r.action)}>{ACTION_LABEL[r.action] ?? r.action}</Pill>
                  <span className="font-semibold">{r.symbol}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{r.rationale}</p>
                <p className="mt-1 text-xs text-faint">Cambiaría si: {r.wouldChangeIf}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Agenda */}
      {p.agenda.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <CalendarDays size={18} strokeWidth={1.75} className="text-brass" />
            Próxima semana
          </h2>
          <div className="mt-3 space-y-2">
            {p.agenda.map((a, i) => (
              <div key={i} className="flex items-baseline gap-3 text-sm">
                <span className="font-mono text-xs tabular-nums text-faint">{a.date}</span>
                <span className="font-semibold">{a.symbol}</span>
                <span className="text-muted">{a.event}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Informe completo (archivo) */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-muted transition hover:text-brass">
          Ver informe completo (markdown)
        </summary>
        <Card className="mt-3">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
            {report.markdown}
          </pre>
        </Card>
      </details>

      <p className="text-xs text-faint">
        Generado {since(report.generatedAt.toISOString())} · semana {report.week}
      </p>
    </div>
  );
}

/** Selector de semanas (links — sin JS de cliente). */
export function WeekPicker({ weeks, current }: { weeks: { week: string }[]; current: string }) {
  if (weeks.length <= 1) return null;
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {weeks.map(({ week }) => (
        <Link
          key={week}
          href={`/investments/reports?week=${week}`}
          className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs tabular-nums transition ${
            week === current
              ? "bg-brass-dim text-brass"
              : "border border-line-2 text-muted hover:text-brass"
          }`}
        >
          {week}
        </Link>
      ))}
    </nav>
  );
}
