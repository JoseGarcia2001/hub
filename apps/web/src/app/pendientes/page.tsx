import Link from "next/link";
import { pendientes } from "@hub/core";
import { requireSession } from "@/lib/session";
import { PendienteForm } from "@/modules/pendientes/PendienteForm";
import { alternarPendiente, eliminarPendiente } from "@/modules/pendientes/actions";

const fechaFmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export default async function PendientesPage() {
  const { user } = await requireSession();
  const items = await pendientes.listarPendientes(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Hub</Link>
      <h1 className="mt-1 mb-6 text-2xl font-semibold">Pendientes</h1>

      <PendienteForm />

      <ul className="mt-6 flex flex-col gap-2">
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-black/15 dark:border-white/15 p-6 text-center text-sm text-neutral-500">
            Nada pendiente. 🎉
          </li>
        )}
        {items.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5"
          >
            <form action={alternarPendiente}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                aria-label={p.hecho ? "Marcar como pendiente" : "Marcar como hecho"}
                className={`grid h-5 w-5 place-items-center rounded-full border text-xs ${
                  p.hecho
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-black/30 dark:border-white/30"
                }`}
              >
                {p.hecho ? "✓" : ""}
              </button>
            </form>

            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm ${p.hecho ? "text-neutral-400 line-through" : ""}`}>
                {p.titulo}
              </div>
              {p.detalle && <div className="truncate text-xs text-neutral-500">{p.detalle}</div>}
            </div>

            {p.vence && (
              <time className="shrink-0 text-xs text-neutral-500">{fechaFmt.format(p.vence)}</time>
            )}

            <form action={eliminarPendiente}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="shrink-0 text-xs text-neutral-400 hover:text-red-500">
                Eliminar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
