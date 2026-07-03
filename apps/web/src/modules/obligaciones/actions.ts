"use server";

import { revalidatePath } from "next/cache";
import { obligaciones } from "@hub/core";
import { requireSession } from "@/lib/session";

/**
 * Override manual de Jose sobre una instancia (marcar pagada fuera de Caja, o revertir
 * para que la reconciliación reintente). Server Action → siempre requireSession acá.
 */
export async function marcarPagado(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(formData.get("id") || "");
  const pagado = formData.get("pagado") === "true";
  if (id) await obligaciones.marcarPagado(user.id, id, pagado);
  revalidatePath("/obligaciones");
}
