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
  // 2026-08-14 田平氏 GO (Phase 3 レイアウト改修):
  // - leading: event-risk (最新記事) を schedule 直下へ・観測リストは
  //   radar-observations として独立させ flash-promotion 直下へ・focus は末尾へ
  // - coincident: mkt12-reading (今朝の12指標) を lead-article 直下へ
  // 2026-08-23 田平氏 GO B-1 (Signal 前面化): lead-article + mkt12-reading を
  //   morning-desk (「Daily Intel」帯 = compact な Daily Intel + サムネなし 12指標行)
  //   1 モジュールへ統合。Daily Intel ブロックだけ <xl hidden (D8・hero が担う)。
  //   spec: docs/superpowers/specs/2026-08-23-home-morning-desk-design.md
  leading: [
    "session-now",
    "schedule",
    "event-risk",
    "flash-promotion",
    "radar-observations",
    "focus",
  ],
  coincident: ["morning-desk", "signal-timeline", "mkt12-tiles", "lane-values"],
  // - lagging (2026-08-23 田平氏 GO A): 記事 4 枠 (deep-dive / atlas-entry /
  //   mkt12-weekend / weekly-brief) は描画時に各枠の最新記事の公開順へ並べ替える
  //   (lib/home/lagging-order.ts)。ここに書く順は「集合 + 同時刻/記事なし時の
  //   tie-break 順」で、末尾 2 枠 (latest-articles / turning-point-reserved) は固定
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
