"use client";

import { useActionState } from "react";
import { crearPendiente, type CrearState } from "./actions";

const initial: CrearState = {};

export function PendienteForm() {
  const [state, action, pending] = useActionState(crearPendiente, initial);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border border-black/10 dark:border-white/15 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="titulo"
          required
          maxLength={200}
          placeholder="¿Qué tienes pendiente?"
          className="flex-1 rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <input
          name="vence"
          type="date"
          className="rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Guardando…" : "Agregar"}
        </button>
      </div>
      <input
        name="detalle"
        maxLength={2000}
        placeholder="Detalle (opcional)"
        className="rounded-lg border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
      />
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
