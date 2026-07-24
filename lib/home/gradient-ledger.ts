// 正本 = CP doctrine §4「勾配台帳」(G44 leading/coincident/lagging 改訂)。
// livemakers-interface-light-first-macro-crypto-rwa.md の窓台帳を写したもの。
// DOM 順 = 領域の順 + 領域内の記載順 (モバイル縦積み・SR・列追加が自動一致)。
// 本ファイルとテスト・実装コンポーネントは同一 import を共有し、drift を封じる (D14)。

export const GRADIENT_REGIONS = ["hero", "leading", "coincident", "lagging"] as const;

export type GradientRegion = (typeof GRADIENT_REGIONS)[number];

/**
 * 各領域のモジュール DOM 順 (doctrine §4 勾配台帳)。
 * data-column-module 属性はこの配列から map で描画する (リテラル直書き禁止・T7/T8/T9)。
 */
export const REGION_MODULES: Readonly<Record<GradientRegion, readonly string[]>> = {
  hero: ["hero-session-line", "hero-lead-headline"],
  leading: ["session-now", "schedule", "flash-promotion", "focus", "event-risk"],
  coincident: ["lead-article", "signal-timeline", "mkt12-tiles", "mkt12-reading", "lane-values"],
  lagging: [
    "deep-dive",
    "atlas-entry",
    "mkt12-weekend",
    "weekly-brief",
    "latest-articles",
    "turning-point-reserved",
  ],
} as const;

/**
 * data-index-nav 扱いのモジュール (articleId 重複検査から除外 = gate 6)。
 * hero のリンク行 + 索引系 (未来アトラス入口 / 週末12指標 / Weekly Brief / 最新記事)。
 * DeepDiveShelf の featured 1 本は本体扱いのため含めない (残り 4 本の title 行が
 * data-index-nav なのはコンポーネント側で付与する)。
 */
export const INDEX_NAV_MODULES: readonly string[] = [
  "hero-session-line",
  "hero-lead-headline",
  "atlas-entry",
  "mkt12-weekend",
  "weekly-brief",
  "latest-articles",
] as const;
