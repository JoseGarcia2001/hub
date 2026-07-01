# Latón — sistema de diseño del Hub

**Una sola línea de diseño en TODAS las pantallas.** Antes de estilar cualquier cosa —
pantalla nueva o retoque— lee esto. Si vas a escribir un color, un tamaño de fuente o un
componente, ya existe la forma correcta abajo.

Filosofía: **cockpit financiero personal**. Dark-first, cálido, preciso. El resumen antes
que el detalle; los números mandan; calma en reposo.

## Reglas de oro (no negociables)

1. **Mobile-first — es LA tesis de desarrollo.** Se diseña para móvil primero. Las clases
   base son el estado móvil; `sm:`/`md:`/`lg:` **solo escalan hacia arriba**, nunca al revés
   (nada de usar `max-*` para achicar). Grids que apilan en móvil (`grid-cols-1`/`grid-cols-2`
   → `lg:grid-cols-4`), contenedores `px-4 sm:px-6`, tablas anchas en `overflow-x-auto`,
   acciones primarias con buen toca-target (`py-3` en botones de formulario). Piensa el
   layout a 375px de ancho antes que a 1440px.
2. **Nunca hardcodees color.** Nada de hex sueltos ni colores crudos de Tailwind
   (`neutral-*`, `emerald-*`, `red-*`, `amber-*`, `bg-black`, `text-white`…). **Siempre tokens.**
3. **Nunca uses variantes `dark:`.** Los tokens ya cambian solos por `prefers-color-scheme`
   (ver `app/globals.css`). Un `dark:` en el código = sistema roto.
4. **Verde y rojo = SOLO valor.** `up`/`down` significan sube/baja (P&L, ganancia/pérdida,
   estado de valor). La marca, las acciones y el acento son **`brass`** (latón). Jamás verde
   para "éxito de UI" ni rojo para "botón peligro" que no sea pérdida de valor.
5. **Tipografía por rol.** Datos/cifras → `font-mono tabular-nums`. Títulos de página o
   sección → `font-display`. Cuerpo e interfaz → sans (default, no hace falta clase).
6. **Reutiliza antes de crear.** Toda primitiva vive en `@/components/ui`. Revisa si una ya
   sirve; extiéndela antes de inventar otra.

## Tokens (fuente de verdad: `app/globals.css`)

Se exponen como utilities de Tailwind. Usa el nombre, no el valor.

| Utility | Uso |
|---|---|
| `bg-ink` / `text-fg` | Fondo de página / texto principal |
| `bg-surface` / `bg-surface-2` | Cards, tablas, paneles / hover, inset |
| `text-muted` / `text-faint` | Texto secundario / terciario, labels, ejes |
| `text-brass` `bg-brass` `text-brass-bright` `bg-brass-dim` | **Marca / acento / acción** |
| `text-up` `bg-up-dim` | **Solo valor:** sube, ganancia, positivo |
| `text-down` `bg-down-dim` | **Solo valor:** baja, pérdida, negativo |
| `border-line` / `border-line-2` | Bordes sutiles / bordes marcados |
| `font-display` / `font-sans` / `font-mono` | Bricolage Grotesque / Hanken Grotesk / IBM Plex Mono |

`text-ink` sobre `bg-brass` da buen contraste en ambos modos (se invierte solo).

## Primitivas (`import { … } from "@/components/ui"`)

```tsx
<PageHeader title="Inversiones" back />                       // back-link + título display + acción opcional
<PageHeader title="Hub personal" subtitle="…" action={<X/>} />
<Card className="…">…</Card>                                   // contenedor base (border-line + bg-surface)
<Stat label="NAV" value={money(n)} sub={pct(x)} tone="neg" /> // cifra de resumen; tone pos|neg = verde/rojo
<Button variant="primary|ghost|quiet">…</Button>              // primary=latón, ghost=borde, quiet=enlace
<Input name="…" placeholder="…" />                            // input de formulario ya estilizado
<Pill tone="up|down|brass|ghost|soon">…</Pill>                // estado en forma, no solo color
<EmptyState tone="brass|neutral" title="…">…</EmptyState>     // vacío o dato ausente
```

## Receta: pantalla nueva

```tsx
import { PageHeader, Card, Stat, EmptyState } from "@/components/ui";

export default async function XPage() {
  await requireSession();
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHeader title="Título" back />
      {/* Cifras: font-mono tabular-nums. Estado: <Pill>. Vacío: <EmptyState>. */}
    </main>
  );
}
```

Contenedor mobile-first: `mx-auto w-full max-w-{3xl|5xl} px-4 py-8 sm:px-6 sm:py-10`. Nada
centrado por defecto salvo pantallas de una sola tarjeta (login).

## Extender el sistema (sin romper la línea)

- **Color nuevo:** agrégalo como token en `globals.css` (en `:root`, en `@media light` y en
  `@theme inline`). Nunca un hex suelto en un componente.
- **Componente reutilizable (≥2 usos reales):** créalo en `components/ui/`, expórtalo en
  `index.ts` y documenta su firma aquí.
- **Un solo uso:** déjalo en su pantalla, pero con tokens. No abstraigas de más (ponytail).

## Referencia visual

Style guide viva (paleta, tipografía y componentes con datos reales del portafolio):
https://claude.ai/code/artifact/21a7541b-cff1-4e59-8172-9c72b9269d6f
