# Features del hub — registro vivo

Qué existe, dónde vive y cómo se usa. Una sección por dominio. Al terminar una feature, actualizar su sección aquí (definition of done — ver SKILL.md).

Convención de capas (detalle en `AGENTS.md` raíz): tabla (`packages/db/src/schema/`) → validadores (`packages/db/src/validators.ts`) → namespace (`packages/core/src/`) → módulo web (`apps/web/src/modules/`) + route (`apps/web/src/app/`).

## pendientes — tareas con fecha límite (dominio plantilla)

- Tabla `pendiente`. Namespace `pendientes`: `listarPendientes` / `crearPendiente` / `alternarPendiente` / `eliminarPendiente`, todo scoped por userId.
- Módulo `modules/pendientes/` (actions + `PendienteForm` con `useActionState`), route `/pendientes`.
- Sin API m2m ni integración externa. Es la referencia mínima para copiar al crear un dominio.

## investments — portafolio IBKR (snapshot en DB)

- Tabla `portfolio_snapshot` (posiciones en jsonb, índice `(userId, asOf)`). **La página lee de la DB, nunca del bróker** — disponibilidad no depende de ningún equipo; frescura por `asOf`.
- Namespace `investments`: `ingest()` (SSOT de ingesta: lee bróker + persiste), `getLatestSnapshot(userId)`, `getOwnerSnapshot()` (m2m, sin sesión).
- Fuentes (seam `InvestmentsSource`, selector env `INVESTMENTS_SOURCE`): `flex` = IBKR Flex Web Service, headless, la de prod; `cp-rest` = gateway local del Mac (alterna, solo local).
- API m2m (bearer `INGEST_SECRET`, excluidas del proxy):
  - `GET/POST /api/cron/ingest` — dispara ingesta. La llama el crontab del server (21:00 UTC, L-V; log en `~/sites/hub/ingest.log`).
  - `GET /api/portfolio` — último snapshot (404 si no hay).
- **Consumidor externo:** agente Buffett — `~/Personal/vida-adulta/finanzas/inversiones/pull.sh` hace GET `/api/portfolio` con el token guardado en el Keychain del Mac.
- Gotchas IBKR Flex: la query se configura con `Models=Optional` (con `All`, IBKR devuelve costo base y P&L en 0), Open Positions nivel **Summary**, e incluir "Net Asset Value (NAV) in Base" + campos `conid, symbol, markPrice, fifoPnlUnrealized, fxRateToBase…`. En prod, cp-rest no alcanza el Mac (host-only) → siempre flex.

## caja — ingresos/egresos automáticos desde correos

- Tablas: `caja_tx` (unique `(userId, msgId)` → reingerir el mismo correo no duplica) y `caja_rule` (reglas aprendidas, keyword unique por usuario).
- Namespace `caja`: `ingest(email)` / `ingestBatch(emails)`, `overview(userId)` (todos los meses precomputados + tendencia — el cliente cambia de mes sin volver al server), `reclasificar(userId, id, flujo, categoria)` (override de UNA tx), `remember(userId, rule)` (aprende regla y re-clasifica TODO el histórico).
- Pipeline: `parse.ts` (parser Rappi puro, testeable sin runtime) → `classify.ts` (reglas aprendidas primero, tabla fija después; **`flujoManual ?? flujo` — el override manual siempre gana**) → `store.ts` (upsert idempotente).
- API m2m: `POST /api/caja/ingest` (bearer `INGEST_SECRET`) — acepta un correo `{subject, text/html, messageId}` o `{emails: []}` en batch.
- **Productores externos** (viven en `~/Personal/vida-adulta/finanzas/gastos/`):
  - `caja-worker/` — Cloudflare Email Worker (correos al relay dedicado → POST ingest; la dirección vive en el `wrangler.jsonc` del worker). Flujo en vivo.
  - `backfill.py` — carga histórica desde Gmail (idempotente por Message-ID).
- Montos en COP entero (bigint, sin centavos). UI: `modules/caja/` (`CajaBoard`, `CorregirForm`, `constants.ts` con flujos/categorías), route `/caja` (`force-dynamic`).
- Self-check del dominio: `caja.selfcheck.ts` en core (parser + clasificador).

## push — notificaciones Web Push (+ PWA instalable)

- Tabla `push_subscription` (endpoint unique → re-suscribirse hace upsert, no duplica).
- Namespace `push`: `publicKey` / `isEnabled` (derivados de env `VAPID_*`; **sin claves el feature se apaga con gracia** y el toggle no se renderiza), `savePushSubscription`, `deletePushSubscription`, y **`sendToUser(userId, { title, body, url })`** — la API para que cualquier dominio notifique. Envía a todas las suscripciones del usuario, purga endpoints muertos (404/410), no lanza: retorna `{ sent, failed }`.
- **Cómo enviar una notificación desde otro dominio** (cron, server action, evento):

  ```ts
  import { push } from "@hub/core";
  await push.sendToUser(userId, { title: "Pendiente vence hoy", body: "…", url: "/pendientes" });
  ```

- Cliente: `modules/push/PushToggle.tsx` (registra `public/sw.js`, suscribe con la VAPID pública, estados unsupported / needs-install / denied / off / on, detecta iOS standalone y guía a "Añadir a inicio") + `public/sw.js` (solo eventos `push` y `notificationclick`; sin caché offline — ponytail).
- PWA: `app/manifest.ts` (standalone), íconos `public/icon-{192,512}.png` + `app/icon.svg` + `app/apple-icon.png`, `metadata.appleWebApp` + `viewport` con themeColor por media query en `layout.tsx`.
- Gotchas:
  - **iOS**: push SOLO con la PWA instalada en pantalla de inicio (iOS 16.4+) y el permiso pedido con un gesto dentro de la app instalada. `PushToggle` ya maneja ambos.
  - **VAPID**: un par POR AMBIENTE (dev ≠ prod). La privada vive SOLO en `.env` del server / `.env.local` local — jamás en repo, docs o chat. Si se filtra: generar par nuevo, reemplazar en `.env`, `docker compose -p hub up -d web`; los navegadores deben re-suscribirse.
  - `web-push` requiere `serverExternalPackages: ["web-push"]` en `next.config.ts`.
  - `manifest.webmanifest`, íconos y `sw.js` van EXCLUIDOS del matcher de `src/proxy.ts` — el navegador los pide sin cookie (instalación/splash).

## obligaciones — pagos recurrentes ↔ su pago en Caja

- Correlaciona cada **obligación** recurrente (servicios públicos, moto) con su **pago real en Caja** y avisa por push si llega el vencimiento sin pago. Reemplaza los recordatorios "tontos" de Google Calendar.
- **Modelo (data-driven):** la **factura** del servicio (correo ENEL: total + "pago oportuno" + cuenta) = la obligación del período (cuánto y cuándo); **Caja** = el pago; el **monto exacto** los une aunque el pago entre por un gateway que enmascara al beneficiario (ENEL entra por `A Toda Hora`/`AVAL`/`Occidente-ATH`, rotando cada año — el comercio es inútil, el monto no).
- Tablas: `obligacion` (registro sembrado, unique `(userId, proveedorKey)`) + `obligacion_instancia` (un período, unique `(obligacionId, periodo)`; `caja_tx_id` = link lógico sin FK). Migración 0005.
- Namespace `obligaciones`: `ingestFactura(email)` (parser → instancia idempotente por período), `reconcile(userId, today)` (casa pagos + marca estado), `tick(userId, today)` (reconcile + push), `overview(userId, today)` (timeline por urgencia), `sembrar(userId)` (catálogo idempotente), `marcarPagado` (override manual). `today` (YYYY-MM-DD Bogotá) lo inyecta la ruta → core testeable.
- **Matching** (`match.ts`, puro): `"monto"` = monto exacto de factura ↔ tx en ventana [emisión, venc+20d] (ENEL); `"comercio"` = keyword en comercio (Vanti/EAAB/ETB/moto); `"manual"`. `usados` evita doble-link. Override manual gana.
- **Push**: 3 días antes / el día / diario si venció, solo impagas, máx 1/día (`notificado_en`). Reusa `push.sendToUser`.
- API m2m (bearer `INGEST_SECRET`, excluidas del proxy): `POST /api/obligaciones/ingest` (factura, un correo o `{emails:[]}`), `GET/POST /api/obligaciones/tick` (cron diario 13:00 UTC = 08:00 Bogotá), `POST /api/obligaciones/seed`.
- **Productores externos** (vida-adulta): el **worker relay** rutea por destinatario — `facturas@jogadev.com` → `/api/obligaciones/ingest`. Seed inicial vía `gwsp` (pull de facturas → POST). Filtros Gmail que reenvían ENEL/Vanti/EAAB/ETB a `facturas@` los crea Jose (el MCP no crea filtros en cuenta personal).
- UI: `modules/obligaciones/` (`ObligacionesBoard`, `actions`, `constants`), route `/obligaciones` (`force-dynamic`). Card en el home.
- **Estado (slice 1):** en vivo. ENEL va completa (factura → match por monto); Vanti/EAAB/ETB y moto sembrados con vencimiento fijo + match por comercio (sus parsers de factura se afinan después). Reconciliación del histórico = follow-up. Self-check: `pnpm --filter @hub/core selfcheck:obligaciones`.
- **Nota Latón:** verde/rojo = solo valor. `pagado`=ghost (reposo), `pendiente`=brass (acento), `vencido`=down (plata en riesgo real, no "error de UI").

## auth — transversal (no es un dominio, lo usan todos)

- Better Auth (`packages/auth`): Google OAuth + email/password solo sign-in (`disableSignUp: true` — sin cuenta provisionada, "crear cuenta" permitiría apropiarse de un correo del allowlist). Allowlist `AUTH_ALLOWED_EMAILS` en hook `user.create.before`. El esquema vive generado en `@hub/db/src/schema/auth.ts` (no editar a mano).
- `requireSession()` (`apps/web/src/lib/session.ts`) en TODA página y server action. `bearerOk()` (`apps/web/src/lib/apiAuth.ts`, timingSafeEqual contra `INGEST_SECRET`) en endpoints m2m.
- `src/proxy.ts` = redirect optimista por cookie (la validación real la hace `requireSession`). Todo endpoint m2m y asset público se excluye de su matcher — si no, responde el HTML de /login.
