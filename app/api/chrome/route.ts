import { loadChromeProps } from "@/lib/home/load-home-composition";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import type { ChromeData } from "@/lib/layout/chrome-data";

// 全ページ共通の枠 (ティッカー・来歴帯) が読む (components/layout/SiteChrome.tsx)。
// 市場データの取得は前と同じ保存期間とタグ (TERMINAL_FEED_CACHE_TAG) なので、
// 新しくなる時機も前と同じ (cron の合図)。中身が変わらない間は ISR の書き込みは
// 発生しない。1 日の時間での作り直しは保険 (isr-intervals テスト)
export const revalidate = 86400;

export async function GET() {
  const chrome = await loadChromeProps();
  const body: ChromeData = {
    tickerItems: chrome.tickerItems,
    pageProvenance: chrome.pageProvenance,
    chromeMeta: getSnapshotChromeMeta(chrome.snapshot),
  };
  return Response.json(body);
}
