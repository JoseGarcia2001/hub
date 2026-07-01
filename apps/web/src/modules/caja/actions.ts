"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { caja } from "@hub/core";
import { requireSession } from "@/lib/session";

// Server Actions invocables por POST directo → SIEMPRE requireSession + validar acá.
const flujoEnum = z.enum([
  "consumo", "ingreso", "inversion", "pago_tarjeta", "movimiento_propio", "por_clasificar",
]);

/**
 * Corrige la clasificación de una transacción. Si Jose marca "recordar", enseña una
 * regla (keyword = comercio) y reclasifica todo el store; si no, es un override solo
 * de esa fila. El efectivo siempre = manual ?? auto.
 */
export async function corregir(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const flujo = flujoEnum.safeParse(formData.get("flujo"));
  const categoria = String(formData.get("categoria") || "").trim();
  if (!flujo.success || !categoria) return;

  const recordar = formData.get("recordar") === "on";
  const comercio = String(formData.get("comercio") || "").trim().toLowerCase();

  if (recordar && comercio.length >= 2) {
    await caja.remember(user.id, { keyword: comercio, flujo: flujo.data, categoria });
  } else {
    const id = String(formData.get("id") || "");
    if (id) await caja.reclasificar(user.id, id, flujo.data, categoria);
  }
  revalidatePath("/caja");
}
