import { SERIES_SLUGS } from "@/lib/articles/article-model";

/**
 * ナビの flag-aware 単一導出 (D3 / G44)。記事▾ グループと「未来アトラス」トップレベル項目を
 * surfacePublished から一つの関数で導出し、G46 §11.3「同一リリース」規律を flag flip だけで満たす。
 * href は locale-less (i18n Link 側が locale を前置する)。
 */
export interface NavItem {
  key: string;
  href: string;
}

export interface NavModel {
  articlesGroup: NavItem[]; // flag OFF: 8 項目 / ON: 7 項目 (future-map 除去)
  topLevel: NavItem[]; // ON のとき futureAtlas を先頭に含む
}

type SeriesSlug = (typeof SERIES_SLUGS)[number];

const seriesHref = (slug: SeriesSlug): string => `/articles/series/${slug}`;

export function buildNavModel(surfacePublished: boolean): NavModel {
  // Weekly Brief は series page でなく /brief 誘導 (spec §8-4)。future-map は flag OFF のみ。
  const articlesGroup: NavItem[] = [
    { key: "dailyIntel", href: seriesHref("daily-intel") },
    { key: "signal", href: seriesHref("signal") },
    { key: "deepDive", href: seriesHref("deep-dive") },
    { key: "mkt12Morning", href: seriesHref("mkt12-morning") },
    { key: "mkt12Weekend", href: seriesHref("mkt12-weekend") },
    { key: "eventRiskRadar", href: seriesHref("event-risk-radar") },
    { key: "weeklyBrief", href: "/brief" },
    ...(surfacePublished
      ? []
      : [{ key: "futureMap", href: seriesHref("future-map") }]),
  ];

  // 2026-08-14 Phase 3 (田平氏 GO): メニュー順 = Intelligence Terminal →
  // 記事▾ → (未来アトラス) → About。Header は topLevel[0] を 記事▾ の前に描く。
  const topLevel: NavItem[] = [
    { key: "sessionTerminal", href: "/sessions/archive" },
    ...(surfacePublished
      ? [{ key: "futureAtlas", href: "/future-atlas" }]
      : []),
    { key: "about", href: "/about" },
  ];

  return { articlesGroup, topLevel };
}

/**
 * フラット 1 列ナビ (2026-08-14 田平氏指示 — dropdown 廃止・左揃え)。
 * ヘッダ 1 段目・モバイルパネル・フッタが同一順で共有する:
 * トップ → Intelligence Terminal → Daily Intel → Signal → Deep Dive →
 * 朝の12指標 → 週末の12指標 → Event Risk Radar → Weekly Brief →
 * 次の時代の地図 (published 時は 未来アトラス) → About
 */
export function buildFlatNav(surfacePublished: boolean): NavItem[] {
  const { articlesGroup } = buildNavModel(surfacePublished);
  return [
    { key: "overview", href: "/" },
    { key: "sessionTerminal", href: "/sessions/archive" },
    ...articlesGroup,
    ...(surfacePublished
      ? [{ key: "futureAtlas", href: "/future-atlas" }]
      : []),
    { key: "about", href: "/about" },
  ];
}
