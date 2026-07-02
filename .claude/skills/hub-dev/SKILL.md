---
name: hub-dev
description: Contexto de desarrollo del hub personal (hub.jogadev.com, monorepo Next 16 + Drizzle, self-hosted). Usar antes de desarrollar features, tocar un dominio (pendientes, investments, caja, push), hacer deploy o debuggear el hub. Índice con progressive disclosure — cargar solo el reference que la tarea necesite.
---

# hub-dev — contexto de desarrollo del hub

El hub es la app central de `~/Personal`: monorepo (pnpm + Turborepo), Next 16 + React 19, Postgres 18 + Drizzle, Better Auth single-user. Corre self-hosted en el home server jogadev (WSL + Docker + Cloudflare Tunnel), público en https://hub.jogadev.com. Otros agentes de `~/Personal` lo consumen por API m2m (ver `references/features.md` → consumidores externos).

## Qué leer según la tarea

| Tarea | Leer |
|---|---|
| Reglas de arquitectura + plantilla de dominio (4 capas) | `AGENTS.md` raíz (siempre cargado) |
| Qué features existen, sus APIs y gotchas (incl. cómo mandar un push) | `references/features.md` |
| Crear un dominio nuevo / patrones transversales / checklist | `references/patterns.md` |
| Ciclo dev → PR → CI → deploy, identidad git, env/secretos, rollback | `references/mechanics.md` |
| UI / estilos (sistema Latón) | `apps/web/src/components/ui/AGENTS.md` |
| Reglas específicas de Next.js | `apps/web/AGENTS.md` |
| Aprovisionar el server desde cero (una vez) | `DEPLOY.md` |

## Features existentes (mapa rápido — detalle en features.md)

- **pendientes** — tareas con fecha límite. Dominio plantilla: el más simple, copiar de aquí.
- **investments** — portafolio IBKR por snapshot en DB (ingesta headless Flex vía cron; la página nunca llama al bróker).
- **caja** — ingresos/egresos automáticos desde correos Rappi (Cloudflare Email Worker → `/api/caja/ingest`), clasificación con reglas aprendidas.
- **push** — Web Push + PWA instalable. `push.sendToUser()` es la API para que cualquier dominio notifique al celular.
- **auth** (transversal) — Better Auth con allowlist single-user; `requireSession()` en UI, `bearerOk()` en m2m.

## SSOT — qué vive dónde (no duplicar)

- `AGENTS.md` raíz = reglas de arquitectura y la anatomía de dominio. Este skill NO las repite.
- `references/features.md` = registro vivo de qué existe y cómo se usa (reemplaza a `CHECKPOINT.md` como fuente de "qué hay").
- `references/mechanics.md` = runbook del día a día. `DEPLOY.md` = solo aprovisionamiento inicial.
- Secretos: NUNCA en este skill ni en el repo — viven en `.env.local` (local) y `~/sites/hub/.env` (server, chmod 600).

## Mantenimiento — definition of done

**Una feature no está terminada hasta actualizar `references/features.md`** (su sección: capas, API, gotchas). Si el cambio tocó el flujo operativo (CI, compose, env, deploy), actualizar también `references/mechanics.md`. Si introdujo un patrón nuevo reutilizable, `references/patterns.md`. Docs desactualizadas son peores que no tener docs: la próxima sesión confía en ellas.
