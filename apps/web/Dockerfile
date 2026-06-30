# Imagen de producción del hub (monorepo pnpm + Next 16 standalone).
# Context de build = raíz del monorepo. Dos targets: `builder` (build + migraciones)
# y `runner` (imagen mínima que sirve la web).
# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# --- builder: instala todo, compila Next (standalone). También sirve para migrar. ---
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# --- runner: solo el output autocontenido + estáticos. Sin devDeps ni código fuente. ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN useradd -m nextjs
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
