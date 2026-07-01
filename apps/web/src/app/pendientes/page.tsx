import { pendientes } from "@hub/core";
import { requireSession } from "@/lib/session";
import { PendienteForm } from "@/modules/pendientes/PendienteForm";
import { alternarPendiente, eliminarPendiente } from "@/modules/pendientes/actions";
import { PageHeader, EmptyState } from "@/components/ui";

const fechaFmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export default async function PendientesPage() {
  const { user } = await requireSession();
  const items = await pendientes.listarPendientes(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <PageHeader title="Pendientes" back />

      <PendienteForm />

      <ul className="mt-6 flex flex-col gap-2">
        {items.length === 0 && (
          <li>
            <EmptyState title="Nada pendiente. 🎉" />
          </li>
        )}
        {items.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            <form action={alternarPendiente}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                aria-label={p.hecho ? "Marcar como pendiente" : "Marcar como hecho"}
                className={`grid h-5 w-5 place-items-center rounded-full border text-xs transition ${
                  p.hecho ? "border-up bg-up text-ink" : "border-line-2 text-transparent hover:border-brass"
                }`}
              >
                ✓
              </button>
            </form>

            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm ${p.hecho ? "text-faint line-through" : ""}`}>
                {p.titulo}
              </div>
              {p.detalle && <div className="truncate text-xs text-muted">{p.detalle}</div>}
            </div>

            {p.vence && (
              <time className="shrink-0 font-mono text-xs text-faint">{fechaFmt.format(p.vence)}</time>
            )}

            <form action={eliminarPendiente}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                className="shrink-0 text-xs text-faint transition hover:text-down"
              >
                Eliminar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
