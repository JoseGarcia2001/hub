import type { ReactNode } from "react";
import type { documents } from "@hub/core";
import { Card, Stat } from "@/components/ui";
import { since } from "@/lib/format";

type BlockTone = documents.BlockTone;
type DocBlock = documents.DocBlock;

/**
 * Renderer de documentos por bloques. Server component puro: recorre la lista de
 * bloques del `payload` y pinta cada uno en Latón. Añadir un tipo de bloque =
 * un `case` más aquí + su miembro en `DocBlock` + su validador. Los gráficos son
 * divs con tokens (sin librería): barras horizontales, opcionalmente divergentes.
 *
 * Color de barras: `pos`/`neg` usan verde/rojo como DIRECCIÓN DE VALOR (sesgo
 * alcista/bajista de la señal), no como estado de UI — consistente con Latón.
 */

const BAR_FILL: Record<BlockTone, string> = { pos: "bg-up", neg: "bg-down", brass: "bg-brass" };
const VAL_TEXT: Record<BlockTone, string> = { pos: "text-up", neg: "text-down", brass: "text-brass" };
const CALLOUT_ACCENT: Record<BlockTone, string> = {
  pos: "border-l-up",
  neg: "border-l-down",
  brass: "border-l-brass",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Markdown inline mínimo y SEGURO: `[texto](url)` (solo http/https), `**negrita**`
 * y `` `código` ``. Devuelve nodos React (no HTML crudo) → React escapa el texto,
 * y el regex restringe el esquema de URL. Sin dependencias.
 */
const INLINE_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (let m = INLINE_RE.exec(text); m; m = INLINE_RE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      out.push(
        <a key={key++} href={m[2]} target="_blank" rel="noreferrer" className="text-brass hover:text-brass-bright">
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      out.push(
        <strong key={key++} className="font-semibold text-fg">
          {m[3]}
        </strong>,
      );
    } else if (m[4]) {
      out.push(
        <code key={key++} className="rounded bg-surface-2 px-1 font-mono text-xs">
          {m[4]}
        </code>,
      );
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function BarChart({ block }: { block: Extract<DocBlock, { kind: "bar-chart" }> }) {
  const maxAbs = Math.max(...block.items.map((i) => Math.abs(i.value)), 1);
  return (
    <Card>
      {block.title && <h3 className="font-display text-base font-semibold">{block.title}</h3>}
      {block.note && <p className="mt-1 text-xs text-muted">{block.note}</p>}
      <div className="mt-4 space-y-3">
        {block.items.map((it, i) => {
          const tone: BlockTone = it.tone ?? (it.value < 0 ? "neg" : "brass");
          const w = `${(Math.abs(it.value) / maxAbs) * 100}%`;
          return (
            <div key={i} className="text-xs">
              {/* Etiqueta completa arriba (ancho total, sin recortar) + valor a la derecha; barra debajo. Mobile-first: labels largos no se truncan. */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 font-mono font-medium text-balance">{it.label}</span>
                <span className={`shrink-0 font-mono tabular-nums ${VAL_TEXT[tone]}`}>{signed(it.value)}</span>
              </div>
              {block.diverging ? (
                <div className="mt-1.5 flex items-center">
                  <div className="flex flex-1 justify-end">
                    {it.value < 0 && <div className={`h-4 rounded-l ${BAR_FILL[tone]}`} style={{ width: w }} />}
                  </div>
                  <div className="h-5 w-px shrink-0 bg-line-2" />
                  <div className="flex flex-1 justify-start">
                    {it.value > 0 && <div className={`h-4 rounded-r ${BAR_FILL[tone]}`} style={{ width: w }} />}
                  </div>
                </div>
              ) : (
                <div className="relative mt-1.5 h-4 w-full overflow-hidden rounded bg-surface-2">
                  <div className={`h-full rounded ${BAR_FILL[tone]}`} style={{ width: w }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "heading":
      return block.level === 3 ? (
        <h3 className="text-balance font-display text-base font-semibold">{block.text}</h3>
      ) : (
        <h2 className="text-balance font-display text-lg font-semibold">{block.text}</h2>
      );

    case "prose":
      return (
        <div className="space-y-3">
          {block.text.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted">
              {renderInline(p)}
            </p>
          ))}
        </div>
      );

    case "list": {
      const items = block.items.map((it, i) => (
        <li key={i} className="text-sm leading-relaxed text-muted marker:text-brass">
          {renderInline(it)}
        </li>
      ));
      return block.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-5">{items}</ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-5">{items}</ul>
      );
    }

    case "stat-grid":
      return (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {block.items.map((s, i) => (
            <Stat
              key={i}
              label={s.label}
              value={s.value}
              sub={s.sub}
              tone={s.tone === "pos" ? "pos" : s.tone === "neg" ? "neg" : undefined}
            />
          ))}
        </section>
      );

    case "bar-chart":
      return <BarChart block={block} />;

    case "table":
      return (
        <Card>
          {block.title && <h3 className="font-display text-base font-semibold">{block.title}</h3>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line-2 text-left text-xs uppercase tracking-wide text-faint">
                  {block.columns.map((c, i) => (
                    <th key={i} className="whitespace-nowrap py-2 pr-4 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-line last:border-0">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`py-2 pr-4 align-top ${ci === 0 ? "font-medium" : "text-muted"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && <p className="mt-3 text-xs text-faint">{block.note}</p>}
        </Card>
      );

    case "callout": {
      const tone = block.tone ?? "brass";
      return (
        <div className={`rounded-lg border border-line border-l-2 bg-surface-2 p-4 ${CALLOUT_ACCENT[tone]}`}>
          {block.title && <p className={`font-semibold ${VAL_TEXT[tone]}`}>{block.title}</p>}
          <p className="mt-1 text-sm leading-relaxed">{renderInline(block.text)}</p>
        </div>
      );
    }
  }
}

export function DocumentView({ doc }: { doc: documents.Document }) {
  return (
    <div className="space-y-6">
      {doc.payload.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}

      <p className="border-t border-line pt-4 text-xs text-faint">
        Generado {since(doc.generatedAt.toISOString())}
        {doc.sourceUrl && (
          <>
            {" · "}
            <a href={doc.sourceUrl} target="_blank" rel="noreferrer" className="text-brass hover:text-brass-bright">
              fuente
            </a>
          </>
        )}
      </p>
    </div>
  );
}
