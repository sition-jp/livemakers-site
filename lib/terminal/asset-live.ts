/**
 * Terminal Live Snapshot Contract — TypeScript zod schema.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-30-sde-terminal-live-snapshot-v0.1.md §2
 *
 * Mirrors the JSON shape produced by SDE `terminal_live_tick.py` at
 * `07_DATA/content/intelligence/terminal_assets.live.json`. LMC reads this
 * file via `live-snapshot-reader.ts` and exposes the parsed snapshot through
 * `/api/dashboard/live`. Per spec §4.2 read-only contract: LMC does not
 * persist, augment, or backfill — it only computes display-derived values
 * (e.g. `computeStaleness`, `mergeLivePriceForDisplay`).
 *
 * `staleness_sec` is intentionally absent from the snapshot — it is computed
 * on the consumer side against `updated_at` (spec §4.3).
 */
import { z } from "zod";
import type { Price } from "./asset-summary";

// ── Enums ────────────────────────────────────────────────────────────
export const LiveAssetSource = z.enum(["coingecko", "dexscreener"]);
export type LiveAssetSourceT = z.infer<typeof LiveAssetSource>;

export const LiveCardanoSource = z.enum(["koios"]);

export const LiveStatus = z.enum(["ok", "unavailable"]);
export type LiveStatusT = z.infer<typeof LiveStatus>;

export const LiveAssetTicker = z.enum(["BTC", "ETH", "ADA", "NIGHT"]);
export type LiveAssetTickerT = z.infer<typeof LiveAssetTicker>;

// ── Per-asset live entry ─────────────────────────────────────────────
export const LiveAssetEntrySchema = z.object({
  price_usd: z.number().nullable(),
  change_24h_pct: z.number().nullable(),
  volume_24h_usd: z.number().nullable(),
  source: LiveAssetSource,
  updated_at: z.string().nullable(),
  status: LiveStatus.optional(),
  note: z.string().optional(),
});
export type LiveAssetEntry = z.infer<typeof LiveAssetEntrySchema>;

// ── Cardano top-level entry ──────────────────────────────────────────
export const LiveCardanoEntrySchema = z.object({
  epoch: z.number().int().nullable(),
  epoch_progress_pct: z.number().nullable(),
  latest_block: z.number().int().nullable(),
  block_time_sec: z.number().nullable(),
  source: LiveCardanoSource,
  updated_at: z.string().nullable(),
  status: LiveStatus.optional(),
  note: z.string().optional(),
});
export type LiveCardanoEntry = z.infer<typeof LiveCardanoEntrySchema>;

// ── Top-level snapshot ───────────────────────────────────────────────
export const LiveSourcesSchema = z.object({
  price: z.string(),
  cardano: z.string(),
  night_price: z.string(),
});

export const TerminalLiveSnapshotSchema = z.object({
  schema_version: z.literal("terminal_live_v0"),
  generated_at: z.string(),
  sources: LiveSourcesSchema,
  assets: z.object({
    BTC: LiveAssetEntrySchema,
    ETH: LiveAssetEntrySchema,
    ADA: LiveAssetEntrySchema,
    NIGHT: LiveAssetEntrySchema,
  }),
  cardano: LiveCardanoEntrySchema,
});
export type TerminalLiveSnapshot = z.infer<typeof TerminalLiveSnapshotSchema>;

// ── Display-derived helpers (spec §4.3, §4.4) ────────────────────────

/**
 * Seconds since `updated_at`. Returns null when:
 *   - input is null / undefined / empty string
 *   - input is not a parseable ISO 8601 timestamp
 *
 * Spec §4.3 + user clarification (Day 3-4 review): `updated_at: null` and
 * invalid date both map to staleness=null (UI renders grey "unavailable").
 */
export function computeStaleness(
  updatedAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (updatedAt == null || updatedAt === "") return null;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  return Math.floor((now.getTime() - ts) / 1000);
}

/**
 * Merge live snapshot data over a static `Price` for display.
 *
 * Returns a `Price` shape suitable for PriceCard:
 *   - When `live` is missing, unavailable, or has null price_usd → returns
 *     the static price as-is (caller's existing behaviour preserved).
 *   - Otherwise, overlays live `price_usd` / `change_24h_pct` /
 *     `volume_24h_usd` / `updated_at` / `source` onto the static price,
 *     keeping `market_cap_usd` from static (live snapshot does not carry it).
 *
 * Live `change_24h_pct` may be null even when `price_usd` is set; in that
 * case fall back to static change, then to 0 (Price schema requires non-null).
 */
export function mergeLivePriceForDisplay(
  staticPrice: Price | null,
  live: LiveAssetEntry | null | undefined,
): Price | null {
  if (
    live == null ||
    live.status === "unavailable" ||
    live.price_usd == null ||
    live.updated_at == null
  ) {
    return staticPrice;
  }
  return {
    usd: live.price_usd,
    change_24h_pct:
      live.change_24h_pct ?? staticPrice?.change_24h_pct ?? 0,
    market_cap_usd: staticPrice?.market_cap_usd ?? null,
    volume_24h_usd: live.volume_24h_usd ?? staticPrice?.volume_24h_usd ?? null,
    updated_at: live.updated_at,
    source: live.source,
  };
}
