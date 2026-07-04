import type { LocalizedText } from "@/lib/livemakers-terminal-preview/types";

/**
 * G39-A2 market-lane fixture (doctrine §2/§4/§5: macro / crypto / on-chain
 * RWA, in that ledger order). These are reviewed fixture values; G39-B B2
 * connects the macro/crypto lanes and the ticker to the SDE terminal feed
 * (lib/terminal/live-market-feed.ts), with this fixture as the fallback and
 * as the RWA lane until the B5 gap work lands. Surfaces mark provenance per
 * tile via `badge` (FIXTURE when absent). Cardano appears as a lane member
 * (crypto), never as a standalone pillar.
 */

export type MarketLaneKey = "macro" | "crypto" | "rwa";

/** Freshness provenance (design §3): daily snapshot / per-session / fixture. */
export type MarketLaneBadge = "SNAPSHOT" | "SESSION" | "FIXTURE";

export interface MarketLaneTile {
  id: string;
  label: string;
  /** null = unavailable — render "—", never 0 (unavailable_not_zero). */
  value: string | null;
  /** 24h change in percent; omit for tiles without a meaningful delta. */
  deltaPct?: number;
  note: LocalizedText;
  /** Absent on fixture tiles — surfaces fall back to the FIXTURE marker. */
  badge?: MarketLaneBadge;
  /** Compact data-time label (design §3: every live tile shows its as-of). */
  asOfLabel?: string;
}

export interface MarketLane {
  key: MarketLaneKey;
  tiles: MarketLaneTile[];
  badge?: MarketLaneBadge;
}

export const MARKET_LANES_SOURCE_MODE = "fixture_only" as const;

/** Doctrine §4 ledger order: macro → crypto → rwa. */
export const marketLanesFixture: MarketLane[] = [
  {
    key: "macro",
    tiles: [
      {
        id: "macro.dxy",
        label: "DXY",
        value: "108.4",
        note: { en: "US dollar index", ja: "米ドル指数" },
      },
      {
        id: "macro.us10y",
        label: "US10Y",
        value: "4.18%",
        note: { en: "10-year Treasury yield", ja: "米10年金利" },
      },
    ],
  },
  {
    key: "crypto",
    tiles: [
      {
        id: "crypto.btc",
        label: "BTC / USD",
        value: "$100,230",
        deltaPct: 1.4,
        note: { en: "Bitcoin", ja: "ビットコイン" },
      },
      {
        id: "crypto.total",
        label: "TOTAL MCAP",
        value: "$3.8T",
        note: { en: "Crypto total, incl. altcoins", ja: "暗号資産全体(アルトコイン含む)" },
      },
      {
        id: "crypto.ada",
        label: "ADA / USD",
        value: "$0.16",
        note: { en: "Cardano — lane member", ja: "Cardano(レーン内項目)" },
      },
    ],
  },
  {
    key: "rwa",
    tiles: [
      {
        id: "rwa.tvl",
        label: "RWA TVL",
        value: "$24.5B",
        note: { en: "Tokenized real-world assets", ja: "オンチェーンRWA総額" },
      },
      {
        id: "rwa.stocks",
        label: "TOKENIZED STOCKS",
        value: null,
        note: { en: "Awaiting data source selection", ja: "データソース選定待ち" },
      },
    ],
  },
];

export interface MarketTickerItem {
  id: string;
  label: string;
  value: string;
  deltaPct?: number;
  /** Absent on fixture items — the strip falls back to the Fixture marker. */
  badge?: MarketLaneBadge;
}

/** Ticker strip follows the same lane order; RWA is pinned last. */
export const marketTickerFixture: MarketTickerItem[] = [
  { id: "ticker.dxy", label: "DXY", value: "108.4" },
  { id: "ticker.us10y", label: "US10Y", value: "4.18%" },
  { id: "ticker.btc", label: "BTC", value: "$100,230", deltaPct: 1.4 },
  { id: "ticker.eth", label: "ETH", value: "$3,412", deltaPct: -0.6 },
  { id: "ticker.total", label: "TOTAL", value: "$3.8T" },
  { id: "ticker.rwa", label: "RWA", value: "$24.5B" },
];
