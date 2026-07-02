# Mecánica de desarrollo — del cambio local a prod

## Ciclo local

- `pnpm install --frozen-lockfile` (pnpm vía corepack, versión fijada en `package.json`).
- `pnpm dev` (turbo) → http://localhost:3000. Env local en `apps/web/.env.local` (guía: `.env.example`); DB local `hub` en Postgres 18.
- Gate de calidad (idéntico a CI): `pnpm typecheck && pnpm lint && pnpm build`.

## Cambio de esquema DB

1. Editar/crear tabla en `packages/db/src/schema/<dominio>.ts` + re-export en `schema/index.ts`.
2. `pnpm db:generate` → **revisar el SQL** generado en `packages/db/drizzle/` → `pnpm db:migrate` local.
3. Commitear el `.sql` + `meta/_journal.json` junto al cambio de código. En prod las aplica solo el contenedor `migrate` (one-shot) en cada deploy — no hay paso manual.

## Git / GitHub — identidad PERSONAL, no la laboral

- Remote: `github.com/JoseGarcia2001/hub` (público). Rama principal `main`; cambios por PR.
- Commits SIEMPRE con el noreply personal (nunca el Gmail real ni la identidad habi):

  ```bash
  git -c user.name="Jose Garcia" -c user.email="64565438+JoseGarcia2001@users.noreply.github.com" commit -m "..."
  ```

- El Keychain de macOS impone la cuenta laboral y `gh auth switch` no persiste entre comandos. Operar así:

  ```bash
  TOKEN=$(gh auth token --user JoseGarcia2001)
  GH_TOKEN=$TOKEN gh pr create ...
  git -c credential.helper= push "https://x-access-token:${TOKEN}@github.com/JoseGarcia2001/hub.git" <rama>
  ```

## PR → CI → deploy (automático)

- **PR** → job `ci` (runner hospedado ubuntu-latest): `install --frozen-lockfile` → `typecheck` → `lint` → `build`. Los forks jamás tocan el server (el self-hosted solo corre en push a `main`).
- **Merge a `main`** → job `deploy` (runner self-hosted `jogadev-wsl`, systemd): en `~/sites/hub` hace `git fetch` + `git reset --hard origin/main` + `COMPOSE_PROJECT_NAME=hub docker compose up -d --build` → `migrate` aplica migraciones nuevas → health check `/login` 200 en local (`127.0.0.1:8081`) y público (`hub.jogadev.com`).
- Tras `gh pr create`: dejar `gh pr checks <num> --watch` en background y no dar el flujo por cerrado hasta que el deploy quede verde.
- `DEPLOY.md` documenta el aprovisionamiento inicial del server (una sola vez). El día a día es este flujo — ya **no** se usa rsync.

## Env y secretos

- Local: `apps/web/.env.local` (gitignored). Prod: `~/sites/hub/.env` en el server (chmod 600). **Nunca literales en el repo, docs o chat.**
- **Gotcha compose:** el servicio `web` usa `environment:` EXPLÍCITO (no `env_file`). Toda env nueva requiere TRES pasos: (1) añadirla al `.env` del server, (2) mapearla en `docker-compose.yml`, (3) documentarla en `.env.production.example`. Si falta (2), el contenedor no la ve aunque esté en `.env`. Verificar con `docker compose config`.
- Cambiar solo env (sin código): editar `.env` en el server → `COMPOSE_PROJECT_NAME=hub docker compose up -d web`.
- Acceso al server: `ssh josegarcia@wsl-server` (tailnet). Scripts multilinea SIEMPRE por stdin: `cat script.sh | ssh josegarcia@wsl-server bash -s` (encadenar comandos inline trunca salida). Guía operativa del server: `~/server-guide/` (skill `jogadev-home-server`).

## Operación en prod

- **Rollback:** en el server, `git reset --hard <commit-bueno>` + `COMPOSE_PROJECT_NAME=hub docker compose up -d --build`.
- **Backups DB:** `~/sites/hub/backup-db.sh` (pg_dump | gzip, rota 14) + cron diario 06:00 → `~/backups/hub/`. Ponytail: backup local, no off-site.
- **Cron de inversiones:** crontab del server, 21:00 UTC L-V → `curl -H "Authorization: Bearer $INGEST_SECRET" http://127.0.0.1:8081/api/cron/ingest` (log: `~/sites/hub/ingest.log`).
- **Logs:** `docker compose -p hub logs web -f`.

## Gotchas operativos (aprendidos a golpes)

1. **Lockfile pnpm:** `pnpm add X` puede re-emparejar peers de deps NO relacionadas (caso real: `@better-auth/core` quedó apuntando a un `better-call` incompatible y el build de CI reventó con un export inexistente; local pasaba por node_modules stale). Si CI falla con exports raros tras añadir una dep: `git checkout origin/main -- pnpm-lock.yaml && pnpm install`, y verificar con `pnpm install --frozen-lockfile && pnpm build`. Además, pnpm 11 IGNORA `pnpm.overrides` en `package.json`.
2. **postgres:18:** el volumen se monta en `/var/lib/postgresql` — con `.../data` el contenedor aborta.
3. **`COMPOSE_PROJECT_NAME=hub` siempre** — sin él cambia el prefijo del proyecto y se "pierde" el volumen `hub_hub-db`.
4. **Next standalone en monorepo:** `output: "standalone"` necesita `outputFileTracingRoot` a la raíz del monorepo, y el Dockerfile debe copiar `.next/static` y `public` (si no, assets 404).
5. **Proxy (`src/proxy.ts`):** todo endpoint bearer y asset público (manifest, íconos, `sw.js`) va EXCLUIDO del matcher; si no, el consumidor recibe el HTML de /login en vez del recurso.
6. **`pnpm-workspace.yaml`:** `allowBuilds` exige booleanos reales o `pnpm install` sale con código 1.
7. **IBKR Flex:** `Models=Optional` y nivel Summary (detalle en `features.md` → investments).
