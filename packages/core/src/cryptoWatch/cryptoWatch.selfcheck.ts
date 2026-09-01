import assert from "node:assert/strict";
import { WATCHED, detectCrossings, type WatchLevel } from "./levels";

/**
 * Self-check de la detección de cruces (lógica pura, sin DB ni red).
 * Correr: pnpm --filter @hub/core selfcheck:crypto-watch
 *
 * La lógica se prueba contra un FIXTURE, no contra `WATCHED`. Antes se afirmaba sobre
 * los niveles reales ($67k, $49k…), así que cada revisión de la tesis rompía tests que
 * no tenían nada malo. Los niveles vigilados son data revisable; el detector no.
 * De `WATCHED` solo se verifican invariantes que deben cumplirse siempre.
 */

const FIXTURE: WatchLevel[] = [
  { level: 90_000, direction: "up", label: "techo alto", message: "cruce al alza, nivel alto" },
  { level: 70_000, direction: "up", label: "techo bajo", message: "cruce al alza, nivel bajo" },
  { level: 50_000, direction: "down", label: "piso alto", message: "cruce a la baja, nivel alto" },
  { level: 40_000, direction: "down", label: "piso bajo", message: "cruce a la baja, nivel bajo" },
];

// Cruce al alza: 69k → 71k dispara SOLO el nivel de 70k, no el de 90k.
{
  const hits = detectCrossings(FIXTURE, 69_000, 71_000);
  assert.deepEqual(
    hits.map((h) => h.level),
    [70_000],
  );
}

// Cruce a la baja: 51k → 49k dispara SOLO el piso de 50k.
{
  const hits = detectCrossings(FIXTURE, 51_000, 49_000);
  assert.deepEqual(
    hits.map((h) => h.level),
    [50_000],
  );
}

// Gap grande a la baja: 51k → 39k dispara los dos pisos de una vez.
{
  const hits = detectCrossings(FIXTURE, 51_000, 39_000);
  assert.deepEqual(
    hits.map((h) => h.level).sort((a, b) => b - a),
    [50_000, 40_000],
  );
}

// Sin cruce: vivir más allá de un nivel no re-alerta (anti-spam).
{
  assert.deepEqual(detectCrossings(FIXTURE, 72_000, 80_000), []);
  assert.deepEqual(detectCrossings(FIXTURE, 45_000, 44_000), []);
}

// Borde exacto: tocar el nivel cuenta como cruce (>= / <=).
{
  assert.deepEqual(
    detectCrossings(FIXTURE, 69_000, 70_000).map((h) => h.level),
    [70_000],
  );
  assert.deepEqual(
    detectCrossings(FIXTURE, 51_000, 50_000).map((h) => h.level),
    [50_000],
  );
}

// Dirección respetada: caer desde arriba de 70k NO dispara su alerta "up".
{
  assert.deepEqual(detectCrossings(FIXTURE, 71_000, 69_000), []);
}

// Precio quieto: no hay cruce contra sí mismo.
{
  assert.deepEqual(detectCrossings(FIXTURE, 70_000, 70_000), []);
}

// --- Invariantes de la data vigilada (no de sus valores concretos) ---
assert.ok(WATCHED.length > 0, "WATCHED quedó vacío: el cron correría sin vigilar nada");

for (const asset of WATCHED) {
  assert.ok(asset.coingeckoId.length > 0, `${asset.symbol}: falta coingeckoId`);
  assert.ok(asset.levels.length > 0, `${asset.symbol}: sin niveles, el activo sobra en WATCHED`);

  const levels = asset.levels.map((l) => l.level);
  assert.equal(new Set(levels).size, levels.length, `${asset.symbol}: nivel duplicado`);

  for (const l of asset.levels) {
    assert.ok(l.level > 0, `${asset.symbol} ${l.level}: nivel no positivo`);
    assert.ok(l.label.length > 0, `${asset.symbol} ${l.level}: label vacío`);
    assert.ok(l.message.length > 10, `${asset.symbol} ${l.level}: mensaje vacío`);
  }
}

const ids = WATCHED.map((a) => a.coingeckoId);
assert.equal(new Set(ids).size, ids.length, "coingeckoId duplicado entre activos");

console.log("cryptoWatch selfcheck OK ✓");
