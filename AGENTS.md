# Hub personal de Jose — monorepo

Monorepo (pnpm workspaces + Turborepo) que centraliza los temas personales de Jose, **organizado por dominios**. Corre **todo local** (web + Postgres + gateway IBKR en la máquina de Jose).

## Estructura

```
apps/
  web/              → Next.js (App Router). UI + routing; importa de los packages.
packages/
  db/      (@hub/db)   → Drizzle: esquema + cliente Postgres + migraciones versionadas
  auth/    (@hub/auth) → Better Auth (Google + allowlist de un solo usuario)
  core/    (@hub/core) → tipos de dominio + lógica reutilizable (ej. ingest de inversiones)
  ui/      (@hub/ui)   → design system compartido
```

## Reglas de arquitectura

- **Por dominios.** Cada dominio personal (inversiones, finanzas, salud…) es un módulo aislado. La lógica de dominio vive en `packages/core` o en `apps/web/src/modules/<dominio>`; `app/` solo hace routing + render.
- **Dependencias en una dirección:** `apps/*` → `packages/*`. Los packages no importan de las apps. Entre packages: `web` y `auth` usan `db`; todos pueden usar `core`/`ui`.
- **DB con migraciones.** Todo cambio de esquema pasa por una migración Drizzle versionada (`pnpm db:generate` → `pnpm db:migrate`). Nunca tocar la DB a mano.
- **Validación con Zod en las fronteras.** Datos externos (respuestas de APIs, env, inputs) se validan con Zod donde entran al sistema, no en el consumidor. Cada tabla de dominio expone su validador en `packages/db/src/validators.ts` con `createInsertSchema`/`createSelectSchema` (drizzle-zod), derivado del esquema Drizzle — sin duplicar tipos a mano.
- **Auth alineado con la DB.** El esquema de Better Auth vive en `@hub/db`; la primera migración crea esas tablas. Single-user: solo el correo de Jose entra (allowlist).
- **Server-only para secretos/fuentes externas.** Adapters e integraciones (`core`, llamadas al gateway IBKR) son server-only; nunca se filtran al cliente.
- **Normalizar a moneda base** es responsabilidad del adapter de datos, no del consumidor.
- **Ponytail.** La solución más simple que funcione. No crear packages/módulos vacíos "para después"; se crean cuando se llenan.

## Anatomía de un dominio (plantilla: `pendientes`)

Dominio de referencia para crear los demás. Un dominio es una rebanada vertical en 4 capas:

1. **Tabla** — `packages/db/src/schema/<dominio>.ts`. Hecha a mano (FK `userId`→`user`, `timestamp({ withTimezone: true })`, PK uuid). Re-exportar en `schema/index.ts`. (`schema/auth.ts` lo genera Better Auth, no se edita.) Luego `pnpm db:generate` → `pnpm db:migrate`.
2. **Validadores** — `packages/db/src/validators.ts`: `createInsertSchema`/`createSelectSchema` (drizzle-zod) derivados de la tabla.
3. **Lógica de dominio** — `packages/core/src/<dominio>.ts` (`import "server-only"`): tipos (`$inferSelect`), contrato de input (derivado del validador con `.pick()/.extend()`) y acceso a datos vía `db`, **siempre con scope por `userId`**. Sin React/Next. Exponer como namespace en `core/src/index.ts`.
4. **UI + acciones** — `apps/web/src/modules/<dominio>/`: `actions.ts` (`"use server"`, cada action hace `requireSession()` + valida input + llama a `@hub/core` + `revalidatePath`) y componentes (`useActionState` para forms). La route en `app/<dominio>/page.tsx` solo hace `requireSession()` + render.

Flujo de datos: `app/page` → `core` → `db`. Validación en la frontera (action + env + respuestas externas). Nuevo package del workspace → agregarlo a `transpilePackages` en `apps/web/next.config.ts`.

## Stack
Next 16 · React 19 · TypeScript · Tailwind 4 · Postgres 18 + Drizzle · Better Auth · Zod + drizzle-zod · pnpm + Turborepo.

## Comandos (desde la raíz)
- `pnpm dev` — levanta todo (turbo)
- `pnpm build` / `pnpm lint` / `pnpm typecheck`
- `pnpm db:generate` / `pnpm db:migrate` — migraciones

Para reglas específicas de Next.js, ver `apps/web/AGENTS.md`.
