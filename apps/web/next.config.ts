import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Los packages del monorepo se consumen como TS crudo: Next los transpila.
  transpilePackages: ["@hub/db", "@hub/auth", "@hub/core"],
  // Build autocontenido para Docker (imagen mínima). En monorepo hay que apuntar
  // el tracing a la raíz para que incluya los packages del workspace.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
