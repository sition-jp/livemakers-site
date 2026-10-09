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

interface InstrumentValueFormat {
  decimals: number;
  prefix?: string;
  suffix?: string;
}

// 2026-10-09 田平氏 GO: セッションカードの見出し (SDE が整形した文字列) と
// 同じ桁・記号で数値を出すための表。SDE livemakers_export/home_registry.py の
// INSTRUMENTS (decimal_count / value_prefix / value_suffix) と同じ値にする。
// rwa_tvl は SDE の表に無い (DefiLlama 由来の lane 値) ので載せない。
const INSTRUMENT_VALUE_FORMATS: Partial<Record<InstrumentId, InstrumentValueFormat>> = {
  btc_usd: { decimals: 0, prefix: "$" },
  eth_usd: { decimals: 2, prefix: "$" },
  spx: { decimals: 2 },
  nikkei_futures: { decimals: 0 },
  eur_usd: { decimals: 4 },
  usd_jpy: { decimals: 3 },
  gold: { decimals: 2, prefix: "$" },
  wti: { decimals: 2, prefix: "$" },
  us10y: { decimals: 2, suffix: "%" },
  btc_vol: { decimals: 2 },
  nasdaq: { decimals: 2 },
  brent: { decimals: 2, prefix: "$" },
  xrp_usd: { decimals: 3, prefix: "$" },
  sol_usd: { decimals: 2, prefix: "$" },
  coin_stock: { decimals: 2, prefix: "$" },
};

/** 銘柄ごとの桁数・記号で数値を整形する (表に無い銘柄は従来の toLocaleString)。 */
export function formatInstrumentValue(
  instrumentId: InstrumentId,
  value: number,
): string {
  const format = INSTRUMENT_VALUE_FORMATS[instrumentId];
  if (!format) return value.toLocaleString();
  const rendered = value.toLocaleString("en-US", {
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals,
  });
  return `${format.prefix ?? ""}${rendered}${format.suffix ?? ""}`;
}

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
