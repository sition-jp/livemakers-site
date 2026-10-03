import fs from "fs";

export interface ReadMarketPricesOpts {
  marketIndicatorsJsonlPath: string;
  assets: readonly string[];
  /** 実行時刻 (ISO 8601)。鮮度判定の基準。省略時は現在時刻 */
  nowIso?: string;
  /** 実行日 (JST) からこの日数より前の行は使わない。省略時は MARKET_PRICE_MAX_AGE_DAYS */
  maxAgeDays?: number;
}

/**
 * 2026-10-03 (spec 2026-10-03-livemakers-mkt12-hyperliquid-design D16): SDE が NIGHT の
 * 取得をやめたため、「その銘柄のキーがある最新の日」の値を使うと古い NIGHT が黙って
 * 使われ続ける。実行日 (JST) から 3 日より前の行は読まない。
 */
export const MARKET_PRICE_MAX_AGE_DAYS = 3;

/** nowIso の JST 暦日から maxAgeDays 日前の "YYYY-MM-DD" (この日付以降の行だけを使う) */
export function freshnessCutoffDate(nowIso: string, maxAgeDays: number): string {
  const parsed = Date.parse(nowIso);
  const nowMs = Number.isNaN(parsed) ? Date.now() : parsed;
  const jst = new Date(nowMs + 9 * 60 * 60 * 1000);
  const cutoff = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - maxAgeDays),
  );
  return cutoff.toISOString().slice(0, 10);
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
 * Rows dated before freshnessCutoffDate(nowIso, maxAgeDays) are ignored.
 *
 * Returns an object with only the requested assets that have a fresh price in
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
  const cutoff = freshnessCutoffDate(
    opts.nowIso ?? new Date().toISOString(),
    opts.maxAgeDays ?? MARKET_PRICE_MAX_AGE_DAYS,
  );

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
    if (date.slice(0, 10) < cutoff) continue;
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
