import fs from "fs";

export interface ReadMarketPricesOpts {
  marketIndicatorsJsonlPath: string;
  assets: readonly string[];
}

/**
 * Read latest price per asset from market_indicators.jsonl.
 *
 * Handles production schema drift: the real file mixes multiple flat
 * shapes across dates. Each row is probed for 3 key variants per asset:
 *   1. asset.toLowerCase()           (e.g., "ada")
 *   2. asset.toLowerCase() + "_usd"  (e.g., "ada_usd")
 *   3. asset.toLowerCase() + "_usdt" (e.g., "night_usdt")
 * First numeric finite match wins. Latest date wins across rows.
 *
 * Returns an object with only the requested assets that have a price in
 * at least one row. Missing assets are omitted (callers should check
 * `prices[asset] === undefined` to trigger placeholder fallback).
 *
 * - Missing file → {} (non-blocking)
 * - Malformed lines silently skipped (forward-compat)
 *
 * CLI-only reader: I/O errors other than ENOENT propagate unstructured.
 */
export async function readMarketPrices(
  opts: ReadMarketPricesOpts,
): Promise<Record<string, number>> {
  if (!fs.existsSync(opts.marketIndicatorsJsonlPath)) return {};
  const raw = fs.readFileSync(opts.marketIndicatorsJsonlPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  const latest: Record<string, { date: string; price: number }> = {};
  for (const line of lines) {
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const date = typeof row.date === "string" ? row.date : undefined;
    if (!date) continue;
    for (const asset of opts.assets) {
      const price = extractAssetPrice(row, asset);
      if (price === undefined) continue;
      if (!latest[asset] || date >= latest[asset].date) {
        latest[asset] = { date, price };
      }
    }
  }

  const out: Record<string, number> = {};
  for (const asset of opts.assets) {
    if (latest[asset]) out[asset] = latest[asset].price;
  }
  return out;
}

function extractAssetPrice(
  row: Record<string, unknown>,
  asset: string,
): number | undefined {
  const lower = asset.toLowerCase();
  const candidates = [lower, `${lower}_usd`, `${lower}_usdt`];
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}
