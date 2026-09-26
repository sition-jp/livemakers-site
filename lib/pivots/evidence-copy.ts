/**
 * Maps the producer's fixed English evidence text to i18n keys
 * (turningPoints.evidenceCopy.<key>.{text,meaning}). Spec 2026-09-26 §5.6 R2.
 * Unknown text returns null and the UI shows the raw message.
 */
const EXACT: Record<string, string> = {
  "Price is far from MA20 (top 20% of recent range)": "ma20_far",
  "Price is far from MA50 (top 20% of recent range)": "ma50_far",
  "MACD momentum is improving": "macd_improving",
  "MACD momentum is weakening": "macd_weakening",
  "Price is near a recent range boundary": "range_boundary",
  "30D realized volatility is compressed (bottom 20% of lookback)": "rv_compressed",
  "Bollinger Band width is compressed (bottom 20% of lookback)": "bb_compressed",
  "ATR is rising from a low-volatility area": "atr_rising",
  "Open Interest increased while price stayed range-bound": "oi_up_range_bound",
  "Funding is skewed to one side (top 20% of lookback)": "funding_skewed",
  "Volume expanded sharply versus the 30D average": "volume_spike",
  "Open Interest expanded while price stayed range-bound": "oi_expanded_range_bound",
  "Funding is skewed versus recent history": "funding_skewed_recent",
  "Long/short positioning is crowded, increasing squeeze sensitivity": "ls_crowded",
  "Top trader positioning diverges from broader account positioning": "top_trader_divergence",
};

const RSI_RE = /^RSI is in (oversold|overheated) territory \(([-\d.]+)\)$/;

export const EVIDENCE_COPY_KEYS: readonly string[] = [
  "rsi_oversold",
  "rsi_overheated",
  ...Object.values(EXACT),
];

export interface EvidenceCopyRef {
  key: string;
  /** Interpolation value for templated copy (currently only the RSI reading). */
  value?: string;
}

export function evidenceCopyKey(message: string): EvidenceCopyRef | null {
  const rsi = RSI_RE.exec(message);
  if (rsi) {
    return { key: rsi[1] === "oversold" ? "rsi_oversold" : "rsi_overheated", value: rsi[2] };
  }
  const key = EXACT[message];
  return key ? { key } : null;
}
