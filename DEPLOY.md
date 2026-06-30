# Despliegue a producción — `hub.jogadev.com` (home server + Cloudflare Tunnel)

El hub corre en el **home server jogadev** (PC + WSL2 Ubuntu + Docker). La web es un
contenedor (Next standalone) + Postgres en contenedor. **Cloudflare Tunnel** (contenedor
`cloudflared`, host network) publica `hub.jogadev.com` con HTTPS — **sin abrir puertos en el router**.

```
Internet → hub.jogadev.com (Cloudflare edge, HTTPS) → Cloudflare Tunnel
              → cloudflared (host net) → http://localhost:8081 → contenedor web → Postgres
```

`jogadev.com` (apex) queda libre para el portafolio/landing; el hub vive en el subdominio `hub`.

## Acceso al servidor (desde el Mac)
SSH directo con clave (evita el re-auth de navegador de `tailscale ssh`):
```bash
ssh josegarcia@wsl-server        # host de la tailnet (Tailscale MagicDNS)
```
Guía operativa del server: `~/server-guide/` (SKILL.md = índice). Regla de oro: apps **directo en el túnel**, no por la UI de Cosmos.

## 0. Prerequisitos humanos (una vez)
**Google OAuth** (console.cloud.google.com → cliente OAuth Web):
- Authorized redirect URI: `https://hub.jogadev.com/api/auth/callback/google`
- Authorized JavaScript origin: `https://hub.jogadev.com`

(DNS, HTTPS y puertos NO requieren nada manual: los hace Cloudflare Tunnel.)

## 1. Código al servidor
Desde el Mac (rsync; el build se hace dentro de Docker, no se copian node_modules ni secretos):
```bash
rsync -az --delete \
  --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=.git \
  --exclude='*.tsbuildinfo' --exclude=.env --exclude=.env.local \
  ~/Personal/hub/ josegarcia@wsl-server:~/sites/hub/
```

## 2. Secretos (`.env`, generados en el servidor)
```bash
cd ~/sites/hub
umask 077
{
  echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
  echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
  echo "AUTH_ALLOWED_EMAILS=tu-correo@gmail.com"
  echo "GOOGLE_CLIENT_ID=<del cliente OAuth>"
  echo "GOOGLE_CLIENT_SECRET=<del cliente OAuth>"
  echo "INVESTMENTS_SOURCE=flex"
  echo "IBKR_FLEX_TOKEN=<token del Flex Web Service>"
  echo "IBKR_FLEX_QUERY_ID=<id de la Flex Query>"
  echo "INGEST_SECRET=$(openssl rand -hex 32)"
} > .env
chmod 600 .env
```
`.env` está gitignored y vive solo en el servidor — nunca al repo ni a la imagen.

## 3. Build + arranque
```bash
cd ~/sites/hub
docker compose up -d --build
```
`db` (postgres:18, volumen `hub-db` montado en `/var/lib/postgresql`) → `migrate` (corre las
migraciones Drizzle una vez y termina) → `web` (Next standalone en `127.0.0.1:8081`).

## 4. Túnel (una vez por hostname)
```bash
# CNAME en Cloudflare (apunta el subdominio al túnel 'cosmos')
~/cloudflared tunnel route dns cosmos hub.jogadev.com
# regla de ingress: editar ~/.cloudflared/config.yml, añadir ANTES del catch-all:
#   - hostname: hub.jogadev.com
#     service: http://localhost:8081
~/cloudflared tunnel ingress validate
docker restart cloudflared        # blip de segundos en todo el túnel
docker logs cloudflared | grep "Registered tunnel connection"   # 4 conexiones QUIC
```

## 5. Verificar (desde el Mac)
```bash
dig @1.1.1.1 +short hub.jogadev.com
curl -sI https://hub.jogadev.com         # 307 → /login
```

## Operación
- **Actualizar tras cambios:** re-`rsync` + `docker compose up -d --build` (el `migrate` aplica
  migraciones nuevas solo). Cambio solo de `.env` → `docker compose up -d web` (recrea con el env nuevo).
- **Backups de la DB:** `docker compose exec db pg_dump -U hub hub > backup.sql`.
- **Resiliencia:** contenedores `restart: unless-stopped` + WSL autostart → el stack vuelve solo tras reinicios.

## Inversiones — ingesta automática (Flex Web Service, headless)
La página **lee de la DB**, nunca del bróker en vivo: su disponibilidad no depende de ningún
equipo encendido. Un cron escribe snapshots vía el **Flex Web Service** de IBKR (token, sin
gateway ni login interactivo).

**Una vez (en Client Portal):** crear una *Activity Flex Query* con las secciones
`Net Asset Value (NAV) in Base` y `Open Positions` (nivel Summary; campos: conid, symbol,
description, position, markPrice, positionValue, costBasisPrice, fifoPnlUnrealized, currency,
fxRateToBase) → anotar el **Query ID**. En *Reporting → Flex Web Service Configuration* generar
el **token**. Poner ambos + `INGEST_SECRET` en el `.env` del server y `docker compose up -d web`.

**Cron en el server** (no necesita sudo; corre tras el cierre de NY ≈ 21:00 UTC, días hábiles):
```bash
( crontab -l 2>/dev/null; \
  echo '0 21 * * 1-5 . $HOME/sites/hub/.env; curl -fsS -H "Authorization: Bearer $INGEST_SECRET" http://127.0.0.1:8081/api/cron/ingest >> $HOME/sites/hub/ingest.log 2>&1' \
) | crontab -
```
Probar a mano: `. ~/sites/hub/.env; curl -fsS -H "Authorization: Bearer $INGEST_SECRET" http://127.0.0.1:8081/api/cron/ingest` → JSON `{ok:true, positions, netLiquidation, asOf}`.

*Alternativa cp-rest (gateway local en el Mac):* `INVESTMENTS_SOURCE=cp-rest`; solo sirve corriendo
la ingesta desde una máquina que alcance `localhost:5055` con el gateway logueado. No es el camino del server.

## Notas / pendientes conocidos
- **Login:** requiere el cliente Google OAuth (paso 0). Sin él, `/login` carga pero "Continuar con
  Google" no completa. Solo entra el correo de `AUTH_ALLOWED_EMAILS` (allowlist single-user).
- **El sitio está arriba solo si el server (PC) está encendido.**
