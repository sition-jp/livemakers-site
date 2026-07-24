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

  const topLevel: NavItem[] = [
    ...(surfacePublished
      ? [{ key: "futureAtlas", href: "/future-atlas" }]
      : []),
    { key: "sessionTerminal", href: "/sessions/archive" },
    { key: "about", href: "/about" },
  ];

  return { articlesGroup, topLevel };
}
