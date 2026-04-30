/**
 * Empty / skeleton live snapshot — used by `/api/dashboard/live` when the
 * SDE producer (`terminal_live_tick.py`) has not yet written
 * `terminal_assets.live.json` (pre-cron / pre-launch state).
 *
 * Per spec §7 (frozen scope) and parity with `/api/dashboard`, missing-file
 * is a 200-OK degrade returning a fully-shaped snapshot whose entries all
 * carry `status: "unavailable"` + `updated_at: null`. Consumers compute
 * `staleness=null` for these (grey "unavailable" UI).
 */
import type { TerminalLiveSnapshot, LiveAssetEntry, LiveCardanoEntry } from "./asset-live";

const ABSENT_NOTE = "snapshot file absent";

function unavailableAssetEntry(
  source: "coingecko" | "dexscreener",
): LiveAssetEntry {
  return {
    price_usd: null,
    change_24h_pct: null,
    volume_24h_usd: null,
    source,
    updated_at: null,
    status: "unavailable",
    note: ABSENT_NOTE,
  };
}

function unavailableCardanoEntry(): LiveCardanoEntry {
  return {
    epoch: null,
    epoch_progress_pct: null,
    latest_block: null,
    block_time_sec: null,
    source: "koios",
    updated_at: null,
    status: "unavailable",
    note: ABSENT_NOTE,
  };
}

export function emptyLiveSnapshot(now: Date = new Date()): TerminalLiveSnapshot {
  return {
    schema_version: "terminal_live_v0",
    generated_at: now.toISOString(),
    sources: {
      price: "coingecko",
      cardano: "koios",
      night_price: "dexscreener",
    },
    assets: {
      BTC: unavailableAssetEntry("coingecko"),
      ETH: unavailableAssetEntry("coingecko"),
      ADA: unavailableAssetEntry("coingecko"),
      NIGHT: unavailableAssetEntry("dexscreener"),
    },
    cardano: unavailableCardanoEntry(),
  };
}
