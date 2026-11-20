import type { SnapshotChromeMeta } from "@/lib/home/market-snapshot";
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";

/**
 * 全ページ共通の枠 (ティッカー・来歴帯・スナップショット表示) の中身
 * (2026-11-20・Vercel ISR Writes 削減)。
 *
 * 前は layout がこれを全ページの HTML に焼いていた。市場データは cron の合図
 * (1 日 6 回・TERMINAL_FEED_CACHE_TAG) で新しくなるので、そのたびに全ページの
 * 中身が変わり、作り直すたびに ISR の書き込み料金が掛かっていた (Vercel は
 * 中身が前回と同じなら書き込みを課金しない)。今はブラウザが /api/chrome を
 * 読んで描く (components/layout/SiteChrome.tsx)。fs を読まない。
 */
export type ChromeData = {
  tickerItems: MarketTickerItem[];
  pageProvenance: WindowProvenance;
  chromeMeta: SnapshotChromeMeta;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export function isChromeData(value: unknown): value is ChromeData {
  if (!isObject(value)) return false;
  const { tickerItems, pageProvenance, chromeMeta } = value;
  return (
    Array.isArray(tickerItems) &&
    tickerItems.every(
      (item) =>
        isObject(item) &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.value === "string",
    ) &&
    isObject(pageProvenance) &&
    typeof pageProvenance.packetId === "string" &&
    typeof pageProvenance.asOfJst === "string" &&
    typeof pageProvenance.sourceMode === "string" &&
    typeof pageProvenance.reviewStatus === "string" &&
    isObject(chromeMeta) &&
    typeof chromeMeta.dateLabel === "string" &&
    typeof chromeMeta.asOfLabel === "string"
  );
}
