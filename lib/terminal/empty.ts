/**
 * Empty / skeleton AssetSummary helpers.
 *
 * Used by API routes when the SDE builder has not yet produced
 * `terminal_assets.json` (pre-launch state). Per spec §7.2, this is
 * a 200-OK degrade — not a 503.
 */
import {
  type AssetSummary,
  type AssetsRecord,
  type TerminalAssetT,
  type DashboardResponse,
} from "./asset-summary";

const DISPLAY_NAMES: Record<TerminalAssetT, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  ADA: "Cardano",
  NIGHT: "Midnight",
};

export function emptyAssetSummary(
  asset: TerminalAssetT,
  nowIso: string,
): AssetSummary {
  return {
    asset,
    display_name: DISPLAY_NAMES[asset],
    ticker_symbol: asset,
    price: null,
    signals: { total_active: 0, items: [] },
    news: { total: 0, items: [] },
    updated_at: nowIso,
  };
}

export function emptyAssetsRecord(nowIso: string): AssetsRecord {
  return {
    BTC: emptyAssetSummary("BTC", nowIso),
    ETH: emptyAssetSummary("ETH", nowIso),
    ADA: emptyAssetSummary("ADA", nowIso),
    NIGHT: emptyAssetSummary("NIGHT", nowIso),
  };
}

export function emptyDashboardResponse(nowIso: string): DashboardResponse {
  return {
    assets: emptyAssetsRecord(nowIso),
    meta: {
      generated_at: nowIso,
      source_freshness_sec: -1,
      schema_version: "0.1",
    },
  };
}
