import "server-only";
import { CpRestSource } from "./ingest/cp-rest";
import type { InvestmentsSource } from "./ingest/types";

/**
 * API pública del módulo. `app/` solo importa de aquí.
 * Selector de fuente: hoy REST; el día de mañana se conmuta a WebSocket
 * (tiempo real) o Flex (histórico) por env, sin tocar la UI.
 */
function source(): InvestmentsSource {
  return new CpRestSource();
}

export function getPortfolioSnapshot() {
  return source().getSnapshot();
}

export { PortfolioOverview } from "./components/PortfolioOverview";
export type { PortfolioSnapshot, Position } from "./ingest/types";
export { InvestmentsSourceError } from "./ingest/types";
