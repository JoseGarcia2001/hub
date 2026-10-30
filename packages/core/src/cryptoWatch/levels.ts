// Niveles vigilados: datos, no lógica. La decisión vive en el documento de tesis cripto
// del hub; si cambia, este archivo cambia en el mismo commit.

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
  symbol: "BTC";
  coingeckoId: string;
  levels: WatchLevel[];
};

/**
 * Techo de tamaño, no objetivo de precio: el precio al que BTC pesa el 15% del NAV.
 * Calculado con 0,05120928 BTC y un NAV de $33.431 (2026-08-31); recalcular si cambian
 * la cantidad de monedas o el NAV.
 */
export const WATCHED: WatchAsset[] = [
  {
    symbol: "BTC",
    coingeckoId: "bitcoin",
    levels: [
      {
        level: 98_000,
        direction: "up",
        label: "peso sobre el 15% del NAV",
        message:
          "⚠️ BTC pasó del 15% del NAV solo por precio. Revisar TAMAÑO de la posición, no dirección del mercado: sigue fuera del círculo de competencia y sin tesis viva. Sesión de decisión de recorte.",
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
