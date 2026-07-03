import Link from "next/link";
import { CheckCircle2, Clock, TriangleAlert, Wallet } from "lucide-react";
import type { obligaciones } from "@hub/core";
import { Card, Stat, Pill, Button } from "@/components/ui";
import { cop } from "@/lib/format";
import { marcarPagado } from "./actions";
import { ESTADO_META, textoVencimiento, fechaCorta, periodoLabel } from "./constants";

const ICONO: Record<obligaciones.Estado, typeof CheckCircle2> = {
  pagado: CheckCircle2,
  pendiente: Clock,
  vencido: TriangleAlert,
};

function Fila({ it }: { it: obligaciones.ObligacionItem }) {
  const meta = ESTADO_META[it.estado];
  const Icon = ICONO[it.estado];
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{it.nombre}</span>
          <Pill tone={meta.tone}>
            <Icon size={12} strokeWidth={2} />
            {meta.label}
          </Pill>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {it.proveedor} · {periodoLabel(it.periodo)} · {textoVencimiento(it.estado, it.diasRestantes)}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm tabular-nums">{cop(it.monto)}</div>
          <div className="text-[11px] text-faint">{fechaCorta(it.fechaVencimiento)}</div>
        </div>
        {it.estado !== "pagado" ? (
          <form action={marcarPagado}>
            <input type="hidden" name="id" value={it.id} />
            <input type="hidden" name="pagado" value="true" />
            <Button variant="quiet" type="submit" className="text-xs">Marcar pagado</Button>
          </form>
        ) : it.pagadoManual ? (
          <form action={marcarPagado}>
            <input type="hidden" name="id" value={it.id} />
            <input type="hidden" name="pagado" value="false" />
            <Button variant="quiet" type="submit" className="text-xs">Deshacer</Button>
          </form>
        ) : it.cajaTxId ? (
          <Link href="/caja" className="text-xs text-muted transition hover:text-brass">en Caja</Link>
        ) : null}
      </div>
    </div>
  );
}

export function ObligacionesBoard({ overview }: { overview: obligaciones.Overview }) {
  const { items } = overview;
  const atencion = items.filter((i) => i.estado !== "pagado");
  const pagadas = items.filter((i) => i.estado === "pagado");
  const vencidas = atencion.filter((i) => i.estado === "vencido");
  const porPagar = atencion.reduce((s, i) => s + i.monto, 0);
  const montoVencido = vencidas.reduce((s, i) => s + i.monto, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Por pagar" value={cop(porPagar)} sub={`${atencion.length} obligación${atencion.length === 1 ? "" : "es"}`} />
        <Stat label="Vencido" value={cop(montoVencido)} sub={`${vencidas.length} vencida${vencidas.length === 1 ? "" : "s"}`} tone={vencidas.length ? "neg" : undefined} />
        <Stat label="Al día" value={String(pagadas.length)} sub="este período" />
      </div>

      {atencion.length > 0 && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-brass">
            <Wallet size={16} strokeWidth={1.75} /> Requieren atención
          </h2>
          <div className="divide-y divide-line">
            {atencion.map((it) => <Fila key={it.id} it={it} />)}
          </div>
        </Card>
      )}

      {pagadas.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-muted">Al día</h2>
          <div className="divide-y divide-line">
            {pagadas.map((it) => <Fila key={it.id} it={it} />)}
          </div>
        </Card>
      )}
    </div>
  );
}
