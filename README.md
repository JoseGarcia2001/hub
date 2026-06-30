# Hub personal

Monorepo personal organizado **por dominios** — una macro-app donde cada tema (inversiones,
pendientes, finanzas…) es un módulo aislado. En vivo (acceso privado) en **[hub.jogadev.com](https://hub.jogadev.com)**.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · PostgreSQL 18 + Drizzle ·
Better Auth · Zod + drizzle-zod · pnpm workspaces + Turborepo.

## Estructura
```
apps/
  web/                → Next.js (UI + routing)
packages/
  db/    (@hub/db)    → Drizzle: esquema + cliente Postgres + migraciones versionadas
  auth/  (@hub/auth)  → Better Auth (Google + email/password, allowlist single-user)
  core/  (@hub/core)  → lógica de dominio reutilizable (server-only)
```
Dependencias en una dirección (`apps/*` → `packages/*`). Cada dominio es una rebanada vertical:
tabla → validadores (drizzle-zod) → lógica en `core` → acciones + UI en `web`. Dominio de
referencia: `pendientes`. Detalle de arquitectura en [`AGENTS.md`](./AGENTS.md).

## Desarrollo
```bash
pnpm install
pnpm db:migrate      # aplica migraciones (requiere Postgres local + packages/db/.env)
pnpm dev             # levanta el monorepo
```

## Producción
Self-hosted en un home server (WSL2 + Docker) y publicado por Cloudflare Tunnel.
Runbook completo en [`DEPLOY.md`](./DEPLOY.md).
