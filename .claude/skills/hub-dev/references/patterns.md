# Patrones del hub — más allá de la plantilla

La anatomía de dominio (4 capas) vive en `AGENTS.md` raíz — leerla primero. Esto la extiende con el checklist completo y los patrones transversales que el código real ya practica.

## Checklist: dominio nuevo

1. **Tabla** en `packages/db/src/schema/<dominio>.ts` + re-export en el barrel → `pnpm db:generate` → revisar SQL → `pnpm db:migrate`.
2. **Validadores** drizzle-zod en `packages/db/src/validators.ts` (`createInsertSchema` con refinamientos de negocio).
3. **Namespace** en `packages/core/src/<dominio>.ts` (carpeta si hay integración externa): `import "server-only"`, tipos por `$inferSelect`, inputs derivados con `.pick()/.extend()`, TODA query scoped por userId. Export como namespace en `core/src/index.ts`.
4. **Módulo web** `apps/web/src/modules/<dominio>/`: `actions.ts` (`"use server"`; cada action = `requireSession()` + `safeParse` + llamada a `@hub/core` + `revalidatePath`) + componentes.
5. **Route** `app/<dominio>/page.tsx` (`requireSession()` + render; `export const dynamic = "force-dynamic"` si los datos cambian fuera de las actions, p.ej. por cron o ingest). Registrar la card del módulo en `app/page.tsx` (arreglo `MODULES`).
6. **¿m2m?** → route en `app/api/.../route.ts` con `bearerOk()` + **excluirla del matcher de `src/proxy.ts`**.
7. **¿Integración externa?** → adapter server-only dentro del namespace, con env validada por Zod AL BOOT (patrón `investments/config.ts`); normalizar a moneda/formato base en el adapter, nunca en el consumidor.
8. **Docs (definition of done):** actualizar `references/features.md`; `mechanics.md` solo si cambió el flujo operativo; `AGENTS.md` solo si cambió una regla de arquitectura.

## Patrones transversales (con su ejemplo real)

- **Env por Zod al boot** — `investments/config.ts`, `core/src/push.ts`. Env opcional = feature que se apaga con gracia (`isEnabled`), no que revienta el arranque.
- **userId scope SIEMPRE**, aunque hoy sea single-user. El userId sale de `requireSession()` o `resolveOwnerUserId()`, jamás del input del cliente.
- **Idempotencia donde entra el mundo exterior** — caja: unique `(userId, msgId)`; push: unique `endpoint` → upsert. Re-entregar no duplica.
- **Errores tipados, no throws sueltos** — `InvestmentsSourceError(kind)` distingue unreachable/unauthenticated/config; `push.sendToUser` acumula `{sent, failed}`; `caja.ingest` retorna `{ok, reason}`.
- **Índices para la query dominante** — `(userId, asOf)` para "último snapshot"; `(userId, fecha)` para vistas por mes.
- **Overview precomputado en server, navegación en cliente** — `caja.overview` entrega todos los meses de una vez; `CajaBoard` cambia de mes sin más fetches.
- **Desacoplar ingesta de lectura** — investments escribe snapshots por cron y la página lee la DB: la disponibilidad no depende de la fuente externa.
- **`// ponytail:`** marca simplificaciones deliberadas con su techo y ruta de upgrade (`// ponytail: global lock, per-account locks si...`). Mantener la convención al simplificar.
- **m2m = bearer + fuera del proxy** — `bearerOk()` (timingSafeEqual) y exclusión en el matcher. Los consumidores externos guardan el token en Keychain (Mac) o en el secret store del worker, nunca en texto plano.

## El hub dentro de ~/Personal

El hub es proveedor de datos para otros agentes del repo padre:

- **Buffett** (inversiones): `vida-adulta/finanzas/inversiones/pull.sh` → GET `/api/portfolio` (token en Keychain `hub-api-token`).
- **Caja**: `vida-adulta/finanzas/gastos/caja-worker/` (Cloudflare Email Worker) y `backfill.py` → POST `/api/caja/ingest`.

Si cambias el contrato de una API m2m, esos consumidores se rompen: actualízalos en el mismo cambio (viven fuera de este repo, en `~/Personal/vida-adulta/`).
