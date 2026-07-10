export type InstrumentId =
  | "btc_usd"
  | "eth_usd"
  | "ada_usd"
  | "night_usdt"
  | "spx"
  | "nikkei_futures"
  | "dxy"
  | "usd_jpy"
  | "gold"
  | "wti"
  | "us10y"
  | "vix"
  | "nasdaq"
  | "dow"
  | "brent"
  | "xrp_usd"
  | "sol_usd"
  | "coin_stock"
  | "rwa_tvl"
  | "tokenized_treasuries"
  | "tokenized_mmf";

export const CORE_12_INSTRUMENTS = [
  "btc_usd",
  "eth_usd",
  "ada_usd",
  "night_usdt",
  "spx",
  "nikkei_futures",
  "dxy",
  "usd_jpy",
  "gold",
  "wti",
  "us10y",
  "vix",
] as const satisfies readonly InstrumentId[];

export type LaneId = "macro" | "crypto" | "rwa";

export interface LaneRowDef {
  instrumentId: InstrumentId;
  nameJa: string;
}

export const LANE_ROWS = {
  macro: [
    { instrumentId: "nasdaq", nameJa: "NASDAQ総合" },
    { instrumentId: "dow", nameJa: "NYダウ" },
    { instrumentId: "brent", nameJa: "Brent原油" },
  ],
  crypto: [
    { instrumentId: "xrp_usd", nameJa: "XRP/USD" },
    { instrumentId: "sol_usd", nameJa: "SOL/USD" },
    { instrumentId: "coin_stock", nameJa: "COIN（米上場株）" },
  ],
  rwa: [
    { instrumentId: "rwa_tvl", nameJa: "RWA TVL" },
    { instrumentId: "tokenized_treasuries", nameJa: "トークン化国債" },
    { instrumentId: "tokenized_mmf", nameJa: "トークン化MMF" },
  ],
} satisfies Record<LaneId, readonly LaneRowDef[]>;

export function assertLaneRowsExcludeCore12(
  rows: Record<LaneId, readonly LaneRowDef[]>,
): void {
  for (const [lane, definitions] of Object.entries(rows)) {
    for (const definition of definitions) {
      if (
        (CORE_12_INSTRUMENTS as readonly InstrumentId[]).includes(
          definition.instrumentId,
        )
      ) {
        throw new Error(
          `lane ${lane} duplicates core-12 instrument: ${definition.instrumentId}`,
        );
      }
    }
  }
}

export const CHARTABLE_INSTRUMENTS = [
  ...CORE_12_INSTRUMENTS,
  "nasdaq",
  "dow",
  "brent",
  "xrp_usd",
  "sol_usd",
  "coin_stock",
] as const satisfies readonly InstrumentId[];
