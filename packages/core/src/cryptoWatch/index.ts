import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@hub/db";
import { z } from "zod";
import * as push from "../push";
import { WATCHED, detectCrossings, type WatchAsset } from "./levels";

/**
 * Vigilancia determinista de los niveles de la tesis cripto. El cron diario llama
 * a `check()`: precio spot (CoinGecko) vs niveles → push SOLO en cruce real
 * (comparado contra el último precio evaluado, persistido en `crypto_price_check`).
 * Aquí no hay juicio: la alerta convoca una sesión de análisis, no ejecuta nada.
 */

export { WATCHED } from "./levels";
export type { WatchAsset, WatchLevel } from "./levels";

const priceEntry = z.object({ usd: z.number() });

/** Precio spot USD por activo vigilado. Falla tipado si CoinGecko no responde bien. */
async function fetchPrices(): Promise<Map<WatchAsset["symbol"], number>> {
  const ids = WATCHED.map((a) => a.coingeckoId).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`CoinGecko respondió ${res.status}`);
  const body = z.record(z.string(), priceEntry).parse(await res.json());
  const prices = new Map<WatchAsset["symbol"], number>();
  for (const asset of WATCHED) {
    const entry = body[asset.coingeckoId];
    if (!entry) throw new Error(`CoinGecko no trajo precio para ${asset.coingeckoId}`);
    prices.set(asset.symbol, entry.usd);
  }
  return prices;
}

export type CheckResult = {
  prices: Record<string, number>;
  crossed: { asset: string; level: number; label: string; notified: boolean }[];
  /** Primera corrida de un activo: solo siembra estado, sin alertas. */
  seeded: string[];
};

/** Corrida del cron: detecta cruces desde la última corrida, notifica y persiste estado. */
export async function check(): Promise<CheckResult> {
  const userId = await resolveOwnerUserId();
  const prices = await fetchPrices();
  const crossed: CheckResult["crossed"] = [];
  const seeded: string[] = [];

  for (const asset of WATCHED) {
    const price = prices.get(asset.symbol)!;
    const [state] = await db
      .select({ lastPrice: schema.cryptoPriceCheck.lastPrice })
      .from(schema.cryptoPriceCheck)
      .where(
        and(eq(schema.cryptoPriceCheck.userId, userId), eq(schema.cryptoPriceCheck.asset, asset.symbol)),
      );

    if (!state) {
      seeded.push(asset.symbol);
    } else {
      for (const hit of detectCrossings(asset.levels, state.lastPrice, price)) {
        let notified = false;
        if (push.isEnabled) {
          const r = await push.sendToUser(userId, {
            title: `${asset.symbol} cruzó $${hit.level.toLocaleString("en-US")} — ${hit.label}`,
            body: hit.message,
            url: "/investments",
          });
          notified = r.sent > 0;
        }
        crossed.push({ asset: asset.symbol, level: hit.level, label: hit.label, notified });
      }
    }

    await db
      .insert(schema.cryptoPriceCheck)
      .values({ userId, asset: asset.symbol, lastPrice: price, checkedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.cryptoPriceCheck.userId, schema.cryptoPriceCheck.asset],
        set: { lastPrice: price, checkedAt: new Date() },
      });
  }

  return { prices: Object.fromEntries(prices), crossed, seeded };
}

/** Dueño del hub (single-user) — mismo patrón que los demás dominios. */
async function resolveOwnerUserId(): Promise<string> {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .orderBy(schema.user.createdAt)
    .limit(1);
  if (!row) {
    throw new Error("No hay usuario provisionado; entra al hub al menos una vez.");
  }
  return row.id;
}
