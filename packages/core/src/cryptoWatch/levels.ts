/**
 * Niveles vigilados — DATA, no lógica. La fuente de verdad conceptual es el
 * documento `tesis-cripto-btc-eth` del hub: si eso cambia, este archivo cambia en
 * el mismo commit (el commit queda como registro de la decisión). Archivo puro
 * (sin server-only) → selfcheck directo de la detección de cruces.
 *
 * ---
 * 2026-08-31 — La tesis de especulación con reglas (ciclo 2025→2027) quedó CERRADA.
 * Se retiraron todos sus niveles: la zona de compra 49k→38,5k, el objetivo de suelo
 * de ~35k y las invalidaciones de BTC/ETH. El método que los produjo (extrapolar el
 * quinto invierno post-halving desde cuatro datos) falló, y ETH cruzó su propia
 * invalidación el 2026-08-27. Conservar esos números después de eso sería estirar el
 * plazo de una predicción que no se cumplió.
 *
 * Lo que queda NO es una tesis: es una banda de tamaño. La posición de BTC existe,
 * pesa doble dígito del NAV y vive fuera del círculo de competencia declarado. El
 * único riesgo que sigue siendo real es que ese peso crezca solo, por precio, entre
 * un informe semanal y el siguiente. Un nivel, un propósito, cero predicción.
 *
 * ETH salió del vigilado: no hay posición ni tesis que sostener.
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
  symbol: "BTC";
  coingeckoId: string;
  levels: WatchLevel[];
};

/**
 * Techo de tamaño, no objetivo de precio. Derivado el 2026-08-31 de la posición real
 * (0,05120928 BTC) contra un NAV de $33.431: el 15% del NAV son $5.015, o sea BTC en
 * ~$98.000. Al corte pesaba 11,9%.
 *
 * El 15% no es una meta a la que haya que llegar — es la línea a partir de la cual el
 * peso deja de ser una herencia y pasa a ser una decisión que no se tomó. Si el NAV se
 * mueve mucho o cambia la cantidad de monedas, este número se recalcula: es aritmética,
 * no lectura de mercado.
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
