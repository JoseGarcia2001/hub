"use server";

import { revalidatePath } from "next/cache";
import { pendientes } from "@hub/core";
import { requireSession } from "@/lib/session";

// Las Server Actions son invocables por POST directo, no solo desde la UI:
// SIEMPRE validar sesión adentro (requireSession) y dejar que el dominio haga el
// scope por userId. La validación de input se hace acá, en la frontera.

export type CrearState = { error?: string };

export async function crearPendiente(_prev: CrearState, formData: FormData): Promise<CrearState> {
  const { user } = await requireSession();
  const parsed = pendientes.crearPendienteInput.safeParse({
    titulo: formData.get("titulo"),
    detalle: formData.get("detalle") || undefined,
    vence: formData.get("vence") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await pendientes.crearPendiente(user.id, parsed.data);
  revalidatePath("/pendientes");
  return {};
}

export async function alternarPendiente(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  await pendientes.alternarPendiente(user.id, String(formData.get("id")));
  revalidatePath("/pendientes");
}

export async function eliminarPendiente(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  await pendientes.eliminarPendiente(user.id, String(formData.get("id")));
  revalidatePath("/pendientes");
}
