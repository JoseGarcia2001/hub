import assert from "node:assert/strict";
import { WATCHED, detectCrossings } from "./levels";

/**
 * Self-check de la detección de cruces (lógica pura, sin DB ni red).
 * Correr: pnpm --filter @hub/core selfcheck:crypto-watch
 */

const btc = WATCHED.find((a) => a.symbol === "BTC")!.levels;
const eth = WATCHED.find((a) => a.symbol === "ETH")!.levels;

// Cruce al alza: 66k → 68k dispara SOLO la señal temprana (67k), no la de 83k.
{
  const hits = detectCrossings(btc, 66_000, 68_000);
  assert.deepEqual(hits.map((h) => h.level), [67_000]);
}

// Cruce a la baja: 50k → 48k dispara SOLO el inicio de zona de compra (49k).
{
  const hits = detectCrossings(btc, 50_000, 48_000);
  assert.deepEqual(hits.map((h) => h.level), [49_000]);
}

// Gap grande a la baja: 50k → 37k dispara los tres escalones de compra, no el objetivo.
{
  const hits = detectCrossings(btc, 50_000, 37_000);
  assert.deepEqual(hits.map((h) => h.level).sort((a, b) => b - a), [49_000, 40_000, 38_500]);
}

// Sin cruce: vivir por encima de un nivel no re-alerta (anti-spam).
{
  assert.deepEqual(detectCrossings(btc, 70_000, 75_000), []);
  assert.deepEqual(detectCrossings(btc, 45_000, 44_000), []);
}

// Borde exacto: tocar el nivel cuenta como cruce (>= / <=).
{
  assert.deepEqual(detectCrossings(eth, 1_800, 1_850).map((h) => h.level), [1_850]);
  assert.deepEqual(detectCrossings(eth, 1_600, 1_527).map((h) => h.level), [1_527]);
}

// Dirección respetada: caer desde arriba de 67k NO dispara la alerta "up" de 67k.
{
  assert.deepEqual(detectCrossings(btc, 68_000, 66_000), []);
}

// Sanidad de la data: niveles únicos por activo y mensajes no vacíos.
for (const asset of WATCHED) {
  const levels = asset.levels.map((l) => l.level);
  assert.equal(new Set(levels).size, levels.length, `${asset.symbol}: nivel duplicado`);
  for (const l of asset.levels) assert.ok(l.message.length > 10, `${asset.symbol} ${l.level}: mensaje vacío`);
}

console.log("cryptoWatch selfcheck OK ✓");
