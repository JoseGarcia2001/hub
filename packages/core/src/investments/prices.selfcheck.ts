import assert from "node:assert/strict";
import { parseChart, toYahooSymbol } from "./prices";

/**
 * Self-check de precios (sin red). Verifica lo no trivial: el mapeo de símbolo
 * IBKR→Yahoo (errarlo grafica otra acción) y el parseo/filtrado de la respuesta,
 * incluido un cierre `null` como el que Yahoo devuelve a veces (visto en BTC).
 * Correr:  pnpm --filter @hub/core selfcheck:prices
 */

// Mapeo de tickers reales del portafolio.
assert.equal(toYahooSymbol("META", "USD"), "META");
assert.equal(toYahooSymbol("BABA", "USD"), "BABA"); // ADR US, tal cual
assert.equal(toYahooSymbol("1211", "HKD"), "1211.HK"); // BYD Hong Kong
assert.equal(toYahooSymbol("1810", "HKD"), "1810.HK"); // Xiaomi Hong Kong
assert.equal(toYahooSymbol("BTC.USD-PAXOS", "USD"), "BTC-USD"); // cripto IBKR

// Parseo: filtra nulls y conserva la moneda nativa.
const ok = parseChart({
  chart: {
    result: [
      {
        meta: { currency: "HKD" },
        indicators: { quote: [{ close: [83.95, 86.15, null, 90.95, 88.7] }] },
      },
    ],
  },
});
assert.ok(ok, "debería parsear");
assert.deepEqual(ok.closes, [83.95, 86.15, 90.95, 88.7]); // el null se cae
assert.equal(ok.currency, "HKD");

// Menos de 2 puntos válidos → no hay línea que pintar.
assert.equal(
  parseChart({
    chart: { result: [{ meta: { currency: "USD" }, indicators: { quote: [{ close: [null, 10] }] } }] },
  }),
  null,
);

// Respuestas basura → null, nunca throw.
assert.equal(parseChart({}), null);
assert.equal(parseChart({ chart: { result: [] } }), null);

console.log("✓ prices.selfcheck: mapeo Yahoo + parseo/filtrado de nulls OK");
