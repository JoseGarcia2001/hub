import Link from "next/link";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { obligaciones } from "@hub/core";
import { Card, Stat, Pill, Button, EmptyState } from "@/components/ui";
import { cop } from "@/lib/format";
import { marcarPagado } from "./actions";
import { esUrgente, textoVencimiento, periodoLabel } from "./constants";

/**
 * Fila mobile-first en dos líneas: (1) qué + cuánto, (2) cuándo + acción/estado.
 * Nada de columnas laterales apretadas: a 375px cada línea respira sola.
 */
function Fila({ it }: { it: obligaciones.ObligacionItem }) {
  const vencida = it.estado === "vencido";
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium">{it.nombre}</span>
        <span className="shrink-0 font-mono text-sm tabular-nums">{cop(it.monto)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`truncate text-xs ${vencida ? "text-down" : "text-muted"}`}>
          {periodoLabel(it.periodo)} · {textoVencimiento(it.estado, it.diasRestantes, it.fechaVencimiento)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {vencida && (
            <Pill tone="down">
              <TriangleAlert size={12} strokeWidth={2} />
              Vencido
            </Pill>
          )}
          {it.estado !== "pagado" ? (
            <form action={marcarPagado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="pagado" value="true" />
              <Button variant="quiet" type="submit" className="py-1 text-xs">Marcar pagado</Button>
            </form>
          ) : it.pagadoManual ? (
            <form action={marcarPagado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="pagado" value="false" />
              <Button variant="quiet" type="submit" className="py-1 text-xs">Deshacer</Button>
            </form>
          ) : it.cajaTxId ? (
            <Link href="/caja" className="text-xs text-muted transition hover:text-brass">ver en Caja</Link>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function Seccion({ titulo, tono, items, total }: {
  titulo: string;
  tono?: "brass" | "muted";
  items: obligaciones.ObligacionItem[];
  total?: number;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className={`text-sm font-semibold ${tono === "brass" ? "text-brass" : "text-muted"}`}>{titulo}</h2>
        {total != null && <span className="font-mono text-xs tabular-nums text-faint">{cop(total)}</span>}
      </div>
      <div className="divide-y divide-line">
        {items.map((it) => <Fila key={it.id} it={it} />)}
      </div>
    </Card>
  );
}

export function ObligacionesBoard({ overview }: { overview: obligaciones.Overview }) {
  const { items } = overview;
  const pendientes = items.filter((i) => i.estado !== "pagado");
  const urgentes = pendientes.filter(esUrgente);
  const proximas = pendientes.filter((i) => !esUrgente(i));
  const pagadas = items.filter((i) => i.estado === "pagado");
  const vencidas = urgentes.filter((i) => i.estado === "vencido");
  const montoUrgente = urgentes.reduce((s, i) => s + i.monto, 0);
  const montoVencido = vencidas.reduce((s, i) => s + i.monto, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Por pagar pronto"
          value={cop(montoUrgente)}
          sub={`${urgentes.length} obligación${urgentes.length === 1 ? "" : "es"} · 30 días`}
        />
        <Stat
          label="Vencido"
          value={cop(montoVencido)}
          sub={vencidas.length ? `${vencidas.length} sin pagar` : "nada en mora"}
          tone={vencidas.length ? "neg" : undefined}
        />
      </div>

      {urgentes.length > 0 ? (
        <Seccion titulo="Requieren atención" tono="brass" items={urgentes} total={montoUrgente} />
      ) : (
        <EmptyState tone="neutral" icon={<CircleCheck size={20} />} title="Nada urgente">
          No hay obligaciones vencidas ni por vencer en los próximos 30 días.
        </EmptyState>
      )}

      <Seccion titulo="Más adelante" items={proximas} total={proximas.reduce((s, i) => s + i.monto, 0)} />
      <Seccion titulo="Al día" items={pagadas} />
    </div>
  );
}
