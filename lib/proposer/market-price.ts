import fs from "fs";

export interface ReadMarketPricesOpts {
  marketIndicatorsJsonlPath: string;
  assets: readonly string[];
}

/**
 * Read latest price per asset from market_indicators.jsonl.
 *
 * Assumes each line is `{date: string, prices: Record<string, number>}`.
 * Returns an object with only the requested assets that have a price in
 * at least one row. Missing assets are omitted (callers should check
 * `prices[asset] === undefined` to trigger placeholder fallback).
 *
 * - Missing file → {} (non-blocking)
 * - Malformed lines silently skipped (forward-compat)
 * - Latest price wins: iterates all rows, keeps price from row with
 *   lexicographically latest `date` (ISO-8601 dates sort correctly)
 *
 * CLI-only reader: I/O errors other than ENOENT propagate unstructured.
 */
export async function readMarketPrices(
  opts: ReadMarketPricesOpts,
): Promise<Record<string, number>> {
  if (!fs.existsSync(opts.marketIndicatorsJsonlPath)) return {};
  const raw = fs.readFileSync(opts.marketIndicatorsJsonlPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  // Latest price per asset (iterate all rows, keep latest by date string)
  const latest: Record<string, { date: string; price: number }> = {};
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as {
        date?: string;
        prices?: Record<string, number>;
      };
      if (!row.date || !row.prices) continue;
      for (const asset of opts.assets) {
        const price = row.prices[asset];
        if (typeof price !== "number" || !Number.isFinite(price)) continue;
        if (!latest[asset] || row.date >= latest[asset].date) {
          latest[asset] = { date: row.date, price };
        }
      }
    } catch {
      // skip malformed
    }
  }

  const out: Record<string, number> = {};
  for (const asset of opts.assets) {
    if (latest[asset]) out[asset] = latest[asset].price;
  }
  return out;
}
