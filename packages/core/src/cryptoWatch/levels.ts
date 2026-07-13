/**
 * Niveles de la tesis cripto — DATA, no lógica. La fuente de verdad conceptual es
 * `~/Personal/vida-adulta/finanzas/inversiones/tesis-cripto.md` (§1 y §4): si la
 * tesis se revisa, se actualiza este archivo en el mismo cambio (el commit queda
 * como registro de la decisión). Archivo puro (sin server-only) → selfcheck
 * directo de la detección de cruces.
 */

/** "up" = alertar cuando el precio cruza el nivel AL ALZA; "down" = a la baja. */
export type LevelDirection = "up" | "down";

export type WatchLevel = {
  level: number;
  direction: LevelDirection;
  /** Nombre corto del nivel (para logs/respuesta del cron). */
  label: string;
  /** Cuerpo del push. La alerta gatilla ANÁLISIS, nunca una orden automática. */
  message: string;
};

export type WatchAsset = {
  symbol: "BTC" | "ETH";
  coingeckoId: string;
  levels: WatchLevel[];
};

export const WATCHED: WatchAsset[] = [
  {
    symbol: "BTC",
    coingeckoId: "bitcoin",
    levels: [
      {
        level: 83_000,
        direction: "up",
        label: "invalidación confirmada",
        message:
          "🔴 Invalidación confirmada: cambió la estructura semanal, la tesis bajista murió. Sesión de decisión de reentrada.",
      },
      {
        level: 67_000,
        direction: "up",
        label: "señal temprana de invalidación",
        message:
          "⚠️ Señal temprana de invalidación (cumple 1 de 2 condiciones). Analizar estructura diaria: ¿hay mínimos crecientes?",
      },
      {
        level: 49_000,
        direction: "down",
        label: "inicio zona de compra",
        message: "🟢 Entró a la zona de compra escalonada (49k→38,5k). Ejecutar primer escalón del plan.",
      },
      {
        level: 40_000,
        direction: "down",
        label: "zona central de compra",
        message: "🟢 Zona central de compra. Escalón grande del plan.",
      },
      {
        level: 38_500,
        direction: "down",
        label: "piso de zona de compra",
        message: "🟢 Piso de la zona de compra. Completar la posición planeada — no más allá.",
      },
      {
        level: 34_000,
        direction: "down",
        label: "objetivo perforado",
        message: "⚠️ Perforó el objetivo de suelo (~35k). NO seguir comprando; revisar la tesis.",
      },
    ],
  },
  {
    symbol: "ETH",
    coingeckoId: "ethereum",
    levels: [
      {
        level: 2_450,
        direction: "up",
        label: "invalidación confirmada",
        message: "🔴 Invalidación ETH confirmada: cambio de estructura. Sesión de decisión.",
      },
      {
        level: 1_850,
        direction: "up",
        label: "señal temprana",
        message:
          "⚠️ Señal temprana ETH: posible doble suelo (proyecta ~2.150). Analizar estructura diaria antes de mover nada.",
      },
      {
        level: 1_527,
        direction: "down",
        label: "primer picoteo",
        message: "🟢 Zona de primer picoteo ETH (~10% de la posición planeada).",
      },
      {
        level: 1_374,
        direction: "down",
        label: "segundo escalón",
        message: "🟢 Segundo escalón del plan ETH.",
      },
      {
        level: 1_080,
        direction: "down",
        label: "zona objetivo",
        message: "🟢 Zona objetivo ETH (soportes 995-1.080). Completar posición.",
      },
      {
        level: 995,
        direction: "down",
        label: "soporte perforado",
        message: "⚠️ ETH perforó el soporte histórico. NO seguir comprando; revisar la tesis.",
      },
    ],
  },
];

/**
 * Cruces REALES entre dos corridas: el nivel quedó entre `lastPrice` y `price`
 * en la dirección vigilada. Vivir más allá de un nivel no re-alerta (anti-spam);
 * solo alerta volver a cruzarlo.
 */
export function detectCrossings(levels: WatchLevel[], lastPrice: number, price: number): WatchLevel[] {
  return levels.filter((l) =>
    l.direction === "up"
      ? lastPrice < l.level && price >= l.level
      : lastPrice > l.level && price <= l.level,
  );
}
