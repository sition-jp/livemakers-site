import type { InstrumentId } from "@/lib/home/instruments";

export type ReaderSessionSlug =
  | "asia-open"
  | "europe-bridge"
  | "ny-open"
  | "global-close";

export type InternalSlot = "morning" | "midday" | "evening" | "night";

export interface ReaderSessionDef {
  slug: ReaderSessionSlug;
  internalSlot: InternalSlot;
  nameEn: string;
  nameJa: string;
  updateTimeLabel: string;
  defaultFocusInstruments: readonly [InstrumentId, InstrumentId];
}

export const READER_SESSIONS = [
  {
    slug: "asia-open",
    internalSlot: "morning",
    nameEn: "Asia Open Terminal",
    nameJa: "朝 · 日本/アジア向け始動マップ",
    updateTimeLabel: "05:03",
    defaultFocusInstruments: ["nikkei_futures", "usd_jpy"],
  },
  {
    slug: "europe-bridge",
    internalSlot: "midday",
    nameEn: "Europe Bridge Terminal",
    nameJa: "昼 · アジアから欧州への橋渡し",
    updateTimeLabel: "12:03",
    defaultFocusInstruments: ["dxy", "us10y"],
  },
  {
    slug: "ny-open",
    internalSlot: "evening",
    nameEn: "NY Open Terminal",
    nameJa: "夕 · 米市場オープンの地図",
    updateTimeLabel: "18:03",
    defaultFocusInstruments: ["spx", "us10y"],
  },
  {
    slug: "global-close",
    internalSlot: "night",
    nameEn: "Global Close / Frontier Terminal",
    nameJa: "夜 · 米引け後とフロンティア観測",
    updateTimeLabel: "22:33–23:03",
    defaultFocusInstruments: ["btc_usd", "gold"],
  },
] as const satisfies readonly ReaderSessionDef[];

export function getSessionBySlug(
  slug: ReaderSessionSlug,
): ReaderSessionDef {
  const definition = READER_SESSIONS.find((session) => session.slug === slug);
  if (!definition) {
    throw new Error(`unknown reader session slug: ${slug}`);
  }
  return definition;
}
