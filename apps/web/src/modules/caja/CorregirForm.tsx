import type { caja } from "@hub/core";
import { corregir } from "./actions";
import { FLUJOS } from "./constants";

const control =
  "rounded-lg border border-line-2 bg-transparent px-2.5 py-1.5 text-sm text-fg transition focus:border-brass";

/**
 * Corrector inline de una transacción (sin JS de cliente: form → server action).
 * "Recordar" enseña la regla para el comercio y reclasifica el histórico. El
 * datalist de categorías (`cat-list`) se declara una sola vez en el board.
 */
export function CorregirForm({ row }: { row: caja.CajaRow }) {
  const comercio = (row.comercio || "").trim();
  return (
    <form action={corregir} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="comercio" value={comercio} />

      <label className="flex flex-col gap-1 text-xs text-faint">
        Flujo
        <select name="flujo" defaultValue={row.flujo} className={control}>
          {FLUJOS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-faint">
        Categoría
        <input
          name="categoria"
          list="cat-list"
          defaultValue={row.categoria}
          autoComplete="off"
          className={control}
        />
      </label>

      {comercio && (
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted">
          <input type="checkbox" name="recordar" className="accent-brass" />
          Recordar «{comercio.length > 24 ? comercio.slice(0, 24) + "…" : comercio}»
        </label>
      )}

      <button
        type="submit"
        className="rounded-lg bg-brass px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-brass-bright"
      >
        Guardar
      </button>
    </form>
  );
}
