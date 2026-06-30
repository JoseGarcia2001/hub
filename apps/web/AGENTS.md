<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# @hub/web

App Next.js del hub. Ver `../../AGENTS.md` para la arquitectura del monorepo.

- `src/app/` → routing delgado; importa de `@hub/core`, `@hub/db`, `@hub/auth`, `@hub/ui`.
- `src/modules/<dominio>/` → módulos de dominio que aún no se han extraído a un package.
- Server Components por defecto; `"use client"` solo con interactividad real.
