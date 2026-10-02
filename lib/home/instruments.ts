// 2026-10-02 田平氏決定 (spec 2026-10-02-livemakers-market-data-hyperliquid-design §4-1):
// 市場データの出所を Yahoo / CoinGecko から Hyperliquid (perp) と米財務省 (米10年金利) へ。
// 並び順と表示名は SDE livemakers_export/home_registry.py と一字一句同じ —
// 配信スキーマ (lib/terminal/live-market-feed.ts) が完全一致を要求する。
export type InstrumentId =
  | "btc_usd"
  | "eth_usd"
  | "spx"
  | "nikkei_futures"
  | "eur_usd"
  | "usd_jpy"
  | "gold"
  | "wti"
  | "us10y"
  | "btc_vol"
  | "nasdaq"
  | "brent"
  | "xrp_usd"
  | "sol_usd"
  | "coin_stock"
  | "rwa_tvl";

export const INSTRUMENT_DISPLAY_NAMES_JA = {
  btc_usd: "BTC/USD",
  eth_usd: "ETH/USD",
  spx: "S&P 500（perp）",
  nikkei_futures: "日経225（perp）",
  eur_usd: "EUR/USD（perp）",
  usd_jpy: "USD/JPY（perp）",
  gold: "Gold（perp）",
  wti: "WTI（perp）",
  us10y: "米10年金利",
  btc_vol: "BTCボラティリティ（BVIV）",
  nasdaq: "米テック100（perp）",
  brent: "Brent（perp）",
  xrp_usd: "XRP/USD",
  sol_usd: "SOL/USD",
  coin_stock: "COIN（perp）",
  rwa_tvl: "RWA TVL",
} as const satisfies Record<InstrumentId, string>;

export const CORE_INSTRUMENTS = [
  "btc_usd",
  "eth_usd",
  "spx",
  "nikkei_futures",
  "eur_usd",
  "usd_jpy",
  "gold",
  "wti",
  "us10y",
  "btc_vol",
] as const satisfies readonly InstrumentId[];

export type LaneId = "macro" | "crypto" | "rwa";

export interface LaneRowDef {
  instrumentId: InstrumentId;
  nameJa: string;
}

export const LANE_ROWS = {
  macro: [
    { instrumentId: "nasdaq", nameJa: INSTRUMENT_DISPLAY_NAMES_JA.nasdaq },
    { instrumentId: "brent", nameJa: INSTRUMENT_DISPLAY_NAMES_JA.brent },
  ],
  crypto: [
    { instrumentId: "xrp_usd", nameJa: INSTRUMENT_DISPLAY_NAMES_JA.xrp_usd },
    { instrumentId: "sol_usd", nameJa: INSTRUMENT_DISPLAY_NAMES_JA.sol_usd },
    { instrumentId: "coin_stock", nameJa: INSTRUMENT_DISPLAY_NAMES_JA.coin_stock },
  ],
  rwa: [
    // 2026-08-14 田平氏裁定: トークン化国債/MMF はデータソース未選定のため撤去中。
    // RWA TVL は market_extras (DefiLlama) live。
    { instrumentId: "rwa_tvl", nameJa: INSTRUMENT_DISPLAY_NAMES_JA.rwa_tvl },
  ],
} satisfies Record<LaneId, readonly LaneRowDef[]>;

export function assertLaneRowsExcludeCore(
  rows: Record<LaneId, readonly LaneRowDef[]>,
): void {
  for (const [lane, definitions] of Object.entries(rows)) {
    for (const definition of definitions) {
      if ((CORE_INSTRUMENTS as readonly InstrumentId[]).includes(definition.instrumentId)) {
        throw new Error(`lane ${lane} duplicates core instrument: ${definition.instrumentId}`);
      }
    }
  }
}

export const CHARTABLE_INSTRUMENTS = [
  ...CORE_INSTRUMENTS,
  "nasdaq",
  "brent",
  "xrp_usd",
  "sol_usd",
  "coin_stock",
] as const satisfies readonly InstrumentId[];
