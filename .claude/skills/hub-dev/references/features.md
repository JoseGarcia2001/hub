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
  - `GET /api/portfolio/history?days=N` — snapshots de los últimos N días (default 8, máx 90), viejo→nuevo. Para los deltas del informe semanal (dominio reports).
- **Consumidor externo:** agente Buffett — `~/Personal/vida-adulta/finanzas/inversiones/pull.sh` hace GET `/api/portfolio` con el token guardado en el Keychain del Mac.
- Gotchas IBKR Flex: la query se configura con `Models=Optional` (con `All`, IBKR devuelve costo base y P&L en 0), Open Positions nivel **Summary**, e incluir "Net Asset Value (NAV) in Base" + campos `conid, symbol, markPrice, fifoPnlUnrealized, fxRateToBase…`. En prod, cp-rest no alcanza el Mac (host-only) → siempre flex.

## caja — ingresos/egresos automáticos desde correos

- Tablas: `caja_tx` (unique `(userId, msgId)` → reingerir el mismo correo no duplica) y `caja_rule` (reglas aprendidas, keyword unique por usuario).
- Namespace `caja`: `ingest(email)` / `ingestBatch(emails)`, `overview(userId)` (todos los meses precomputados + tendencia — el cliente cambia de mes sin volver al server), `reclasificar(userId, id, flujo, categoria)` (override de UNA tx), `remember(userId, rule)` (aprende regla y re-clasifica TODO el histórico).
- Pipeline: `parse.ts` (parser Rappi puro, testeable sin runtime) → `classify.ts` (reglas aprendidas primero, tabla fija después; **`flujoManual ?? flujo` — el override manual siempre gana**) → `store.ts` (upsert idempotente).
- Clasificación (`classify.ts` = la perilla de calibración de dominio): flujos = consumo/ingreso/inversion/pago_tarjeta/movimiento_propio/por_clasificar; categorías de consumo por keyword en el comercio (Mercado, Restaurantes, Domicilios, Transporte, Vehículo, Salud, Educación, Suscripciones, Servicios, Vestuario, Hogar, Compras, Ocio, Viajes, Vivienda, Mascotas). Lo no reconocido cae en **"Otros"** (cola honesta que se afina 1×1 en "Requieren atención"). Gotchas de dominio: el **arriendo** es una transferencia mensual a Nequi (~$2.8-3M) reconocida por **rango de monto** (const `ARRIENDO`) porque el correo no trae el beneficiario — si sube el canon, ampliar el techo; `GLOBAL COLOMBIA 81`/`nu colombia` → pago de tarjeta Nu; `fideicomiso/fiduciaria` → Vivienda (no la Visa Occidente); el orden de `REGLAS` importa (Mascotas antes que Compras, Domicilios antes que Transporte). **Tras afinar `classify.ts` hay que reclasificar** (`POST /api/caja/reclassify`) para recategorizar el histórico.
- API m2m: `POST /api/caja/ingest` (bearer `INGEST_SECRET`) — acepta un correo `{subject, text/html, messageId}` o `{emails: []}` en batch.
- **Productores externos** (viven en `~/Personal/vida-adulta/finanzas/gastos/`):
  - `caja-worker/` — Cloudflare Email Worker (correos al relay dedicado → POST ingest; la dirección vive en el `wrangler.jsonc` del worker). Flujo en vivo.
  - `backfill.py` — carga histórica desde Gmail (idempotente por Message-ID).
- Montos en COP entero (bigint, sin centavos). UI: `modules/caja/` (`CajaBoard` = navegador de tendencia SVG + KPIs que separan **Gasto e Inversión** + sección "Reparto del ingreso" — inversión y pago de tarjeta NO son gasto de vida; bloque "Requieren atención" colapsado para que la data mande; `CorregirForm`, `constants.ts` con flujos/categorías), route `/caja` (`force-dynamic`).
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
- UI: `modules/obligaciones/` (`ObligacionesBoard`, `actions`, `constants`), route `/obligaciones` (`force-dynamic` + `loading.tsx`). Card en el home. **Horizonte de relevancia:** "Requieren atención" = vencido o ≤30 días (`HORIZONTE_DIAS`/`esUrgente` en constants); lo lejano (SOAT en nov, tecno en feb) va a "Más adelante" en reposo. Filas mobile-first en dos líneas (qué+cuánto / cuándo+acción).
- **Estado (slice 1):** en vivo. ENEL va completa (factura → match por monto); Vanti/EAAB/ETB y moto sembrados con vencimiento fijo + match por comercio (sus parsers de factura se afinan después). Reconciliación del histórico = follow-up. Self-check: `pnpm --filter @hub/core selfcheck:obligaciones`.
- **Nota Latón:** verde/rojo = solo valor. `pagado`=ghost (reposo), `pendiente`=brass (acento), `vencido`=down (plata en riesgo real, no "error de UI").

## documents — base ÚNICA de reportes: documentos por BLOQUES (el hub no piensa, publica)

- Contenedor reutilizable para CUALQUIER análisis/documento con contenido rico (texto, cifras, tablas y gráficos), **agnóstico de dominio**. El CONTENIDO lo arma un productor (agente/skill) y lo postea por m2m; el hub valida, persiste, renderiza y notifica por push. División dura: juicio fuera, plomería dentro. No hay moldes de tabla por tipo de reporte — todo es un `document` de un `kind` distinto.
- Tabla `document` (sin nada de inversiones): `slug` (kebab, único por usuario → upsert), `kind` (el "segmento": `superinvestors`, `informe-semanal`, `analysis`…), `title`, `summary`, `payload` jsonb (`DocumentPayload` = `{ blocks: DocBlock[] }`), `sourceUrl?`, `generatedAt`. Unique `(userId, slug)`.
- **Bloques (`DocBlock`, unión discriminada en `schema/documents.ts`):** `heading` · `prose` · `list` (viñetas/numerada) · `stat-grid` (reusa `Stat`) · `bar-chart` (barras div+tokens, `diverging` centra el eje en 0 para netos ±) · `table` · `callout`. `prose`/`list`/`callout` admiten **markdown inline** seguro (`[t](url)` http/https, `**negrita**`, `` `código` `` → nodos React, sin HTML crudo, sin dependencias). Extender = un miembro más + su `case` en `DocumentView` + su rama en `documentPayloadSchema`. Charts SIN librería (verde/rojo = dirección de valor). Un `line-chart` futuro es ese patrón.
- Namespace `documents`: `save` (upsert por slug), `getBySlug`, `list({kind?})`, y variante owner m2m `saveOwnerDocument`.
- API m2m (bearer, excluida del proxy con el prefijo `api/documents`): `POST /api/documents` — valida `saveDocumentInput` (Zod completo, `validators.documentPayloadSchema`), persiste y manda push con link.
- UI: `/investments/analisis` (lista, con pill de `kind` legible) + `/investments/analisis/[slug]` (detalle con `DocumentView`), ambas `force-dynamic` + `loading.tsx`. Link "Análisis" en el header de `/investments`. Vive bajo Inversiones por ahora; sacarlo a un módulo raíz "Documentos" que agrupe segmentos = mover la ruta (el dominio no cambia).
- **Kinds vivos:** `superinvestors` (análisis trimestral de Dataroma, 13F de grandes portafolios — a mano) · `informe-semanal` (el informe de portafolio, lo produce la skill `informe-portafolio`; automatizarlo headless es fase 3 — ver su `references/hub-spec.md`).
- **Historia:** el informe semanal nació con su propio molde (`investment_report`/`ReportView`/`api/reports`), retirado al unificar todo aquí (migración `0008` dropea la tabla). Un solo sistema de reportes, una sola superficie.

## cryptoWatch — vigilancia determinista de niveles de la tesis cripto

- Cero LLM: precio spot (CoinGecko, sin key) vs niveles fijos → push SOLO en cruce real desde la corrida anterior. La alerta convoca una sesión de análisis; jamás ejecuta órdenes.
- **Niveles = DATA en `core/src/cryptoWatch/levels.ts`** (BTC: 83k/67k↑, 49k/40k/38.5k/34k↓; ETH: 2450/1850↑, 1527/1374/1080/995↓). Fuente conceptual: `~/Personal/vida-adulta/finanzas/inversiones/tesis-cripto.md` — si la tesis se revisa, se actualizan juntos (el commit = registro de la decisión).
- Tabla `crypto_price_check` (unique `(userId, asset)`): último precio evaluado → detección de cruce por cambio de lado entre corridas (anti-spam: vivir más allá de un nivel no re-alerta). Primera corrida solo siembra (`seeded`).
- Namespace `cryptoWatch`: `check()` (fetch → detect → push → upsert estado), `WATCHED`. Lógica de cruce pura en `levels.ts` → `pnpm --filter @hub/core selfcheck:crypto-watch`.
- API m2m: `GET/POST /api/cron/crypto-levels` — cron diario del server (cripto opera 7/7, incluir fines de semana).

## auth — transversal (no es un dominio, lo usan todos)

- Better Auth (`packages/auth`): Google OAuth + email/password solo sign-in (`disableSignUp: true` — sin cuenta provisionada, "crear cuenta" permitiría apropiarse de un correo del allowlist). Allowlist `AUTH_ALLOWED_EMAILS` en hook `user.create.before`. El esquema vive generado en `@hub/db/src/schema/auth.ts` (no editar a mano).
- `requireSession()` (`apps/web/src/lib/session.ts`) en TODA página y server action. `bearerOk()` (`apps/web/src/lib/apiAuth.ts`, timingSafeEqual contra `INGEST_SECRET`) en endpoints m2m.
- `src/proxy.ts` = redirect optimista por cookie (la validación real la hace `requireSession`). Todo endpoint m2m y asset público se excluye de su matcher — si no, responde el HTML de /login.
