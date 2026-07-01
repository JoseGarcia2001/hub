"use client";

import { useActionState } from "react";
import { crearPendiente, type CrearState } from "./actions";
import { Button, Input } from "@/components/ui";

const initial: CrearState = {};

export function PendienteForm() {
  const [state, action, pending] = useActionState(crearPendiente, initial);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="titulo" required maxLength={200} placeholder="¿Qué tienes pendiente?" className="flex-1" />
        <Input name="vence" type="date" className="sm:w-auto" />
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Agregar"}
        </Button>
      </div>
      <Input name="detalle" maxLength={2000} placeholder="Detalle (opcional)" />
      {state.error && <p className="text-sm text-down">{state.error}</p>}
    </form>
  );
}
