<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# @hub/web

App Next.js del hub. Ver `../../AGENTS.md` para la arquitectura del monorepo.

- `src/app/` → routing delgado; importa de `@hub/core`, `@hub/db`, `@hub/auth`.
- `src/modules/<dominio>/` → módulos de dominio que aún no se han extraído a un package.
- Server Components por defecto; `"use client"` solo con interactividad real.

## Diseño — Latón (OBLIGATORIO leer antes de tocar UI)

Todo el hub sigue **un solo** sistema de diseño. Antes de estilar cualquier pantalla o
componente, lee **`src/components/ui/AGENTS.md`** (tokens, primitivas y reglas).

Lo esencial que NO se negocia:
- **Solo tokens.** Nunca hex sueltos ni colores crudos de Tailwind (`neutral-*`, `emerald-*`…).
- **Nunca `dark:`.** Los tokens cambian solos por `prefers-color-scheme`.
- **Verde/rojo (`up`/`down`) = solo valor** (P&L). Marca/acción = `brass`.
- **Reutiliza `@/components/ui`** (`PageHeader`, `Card`, `Stat`, `Button`, `Input`, `Pill`,
  `EmptyState`) antes de crear algo nuevo.
