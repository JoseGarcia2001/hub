import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Los packages del monorepo se consumen como TS crudo: Next los transpila.
  transpilePackages: ["@hub/db", "@hub/auth", "@hub/core"],
  // web-push es lib Node (solo server): externa, no se bundlea.
  serverExternalPackages: ["web-push"],
  // Build autocontenido para Docker (imagen mínima). En monorepo hay que apuntar
  // el tracing a la raíz para que incluya los packages del workspace.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  experimental: {
    // Cache del router en cliente: re-navegar a una ruta visitada en <30s no vuelve
    // al server (los datos cambian por cron/correo, no por segundo). Junto con los
    // loading.tsx prefetcheados, la navegación se siente instantánea.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
