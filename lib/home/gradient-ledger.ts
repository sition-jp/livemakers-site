// 正本 = CP doctrine §4「勾配台帳」(G44 leading/coincident/lagging 改訂)。
// livemakers-interface-light-first-macro-crypto-rwa.md の窓台帳を写したもの。
// DOM 順 = 領域の順 + 領域内の記載順 (モバイル縦積み・SR・列追加が自動一致)。
// 本ファイルとテスト・実装コンポーネントは同一 import を共有し、drift を封じる (D14)。

// 2026-10-26 田平氏 GO (2 回目): スマホ専用の hero 領域を廃止。スマホも Intelligence
// Terminal (PC と同じ部品) を先頭にし、Daily Intel・12指標のカードはその下 (leading)。
export const GRADIENT_REGIONS = ["leading", "coincident", "lagging"] as const;

export type GradientRegion = (typeof GRADIENT_REGIONS)[number];

/**
 * 各領域のモジュール DOM 順 (doctrine §4 勾配台帳)。
 * data-column-module 属性はこの配列から map で描画する (リテラル直書き禁止・T7/T8/T9)。
 */
export const REGION_MODULES: Readonly<Record<GradientRegion, readonly string[]>> = {
  // 2026-08-14 田平氏 GO (Phase 3 レイアウト改修):
  // - leading: event-risk (最新記事) を schedule 直下へ・観測リストは
  //   radar-observations として独立させ flash-promotion 直下へ・focus は末尾へ
  // - coincident: mkt12-reading (今朝の12指標) を lead-article 直下へ
  // 2026-08-23 田平氏 GO B-1 (Signal 前面化): lead-article + mkt12-reading を
  //   morning-desk (「Daily Intel」帯 = compact な Daily Intel + サムネなし 12指標行)
  //   1 モジュールへ統合。Daily Intel ブロックだけ <xl hidden (D8・hero が担う)。
  //   spec: 2026-08-23 home-morning-desk design (内部設計文書)
  // 2026-08-23 田平氏 GO: flash-promotion (昇格ペア) を撤去 — 公開以来一度も
  //   ペアが成立しなかった空カード。観測リスト (radar-observations) は残す。
  //   spec: 2026-08-23 terminal-switching-ux design §D (内部設計文書)
  //   (CP doctrine §4 は窓単位の台帳で「Live Radar」は観測カードとして存続 — 改訂不要)
  // 2026-10-09 田平氏 GO (案 A): radar-observations (観測リスト・一次ソースへの
  //   外部リンク) を flash-list (当日+前日の速報記事・自社記事リンク) へ置き換え。
  //   速報レーン稼働で観測と速報記事が同じ件を二重に出していたため。観測データの
  //   wire 契約 (slots.observing / radar-observations.ts) は受理を続け、描画だけ止める。
  // 2026-10-09 田平氏 GO: focus (セッション・フォーカス) を末尾から schedule 直下へ。
  //   セッション → 本日の更新予定 (注目銘柄) → その銘柄のチャートを連続させる。
  //   速報リストは件数で伸びるため、末尾だとチャートが日によって沈んでいた。
  //   CP doctrine §1「フォーカスはセッションカード直後」の意図にも近づく。
  // 2026-10-26 田平氏 GO: morning-desk (8/23 の帯) をやめ、8/22 の lead-article +
  //   mkt12-reading の 2 枚へ戻す。帯の 12指標行の右隣リンクがスマホ幅で行を
  //   押し縮めていたため。signal-timeline は mkt12-reading の直下。
  // 2026-10-26 田平氏 GO: スマホの並び = Intelligence Terminal (session-now・schedule は
  //   PC と同じ部品を全幅で) → Daily Intel 大カード・12指標 小カード (スマホ専用・
  //   xl:hidden) → 速報。中央の lead-article / mkt12-reading は PC 専用。Event Risk は
  //   スマホでは event-risk-mobile (遅行の最新記事の直前) で出し、左の event-risk は
  //   PC 専用。HTML の順番 = スマホの並びは維持する (表示の出し分けで作る)。
  leading: [
    "session-now",
    "schedule",
    "focus",
    "lead-card-mobile",
    "mkt12-card-mobile",
    "event-risk",
    "flash-list",
  ],
  // 2026-10-28 田平氏 GO: 資金調達 (funding・入口 ②) は「いまどこに資金が流れて
  //   いるか」= 現在地なので、遅行の記事枠 (新着順で動く) から一致の固定位置
  //   (直近の Signal の直下) へ。同じ Signal が上の欄と並ぶ日も索引行のまま許容。
  coincident: [
    "lead-article",
    "mkt12-reading",
    "signal-timeline",
    "funding",
    "mkt12-tiles",
    "lane-values",
  ],
  // - lagging (2026-08-23 田平氏 GO A): 記事 4 枠 (deep-dive / atlas-entry /
  //   mkt12-weekend / weekly-brief) は描画時に各枠の最新記事の公開順へ並べ替える
  //   (lib/home/lagging-order.ts)。ここに書く順は「集合 + 同時刻/記事なし時の
  //   tie-break 順」で、末尾 2 枠 (latest-articles / turning-point-reserved) は固定
  //   2026-10-26: event-risk-mobile (スマホ専用) も末尾側の固定枠で最新記事の直前
  //   2026-10-29 田平氏 GO (C 案): restart-map (金融再起動の現在地・月 1 回) を記事の
  //   枠に加える。固定にせず新着順に混ぜ、公開直後だけ自然に上へ来る
  //   2026-10-31 田平氏 GO: video (最新の動画・YouTube に上がった回だけ) を記事の枠の
  //   直後の固定枠に。投稿前の回しか無いあいだは枠ごと非表示。記事を載せない枠なので
  //   INDEX_NAV_MODULES (記事 id の重複検査の除外) には入れず、窓自身が data-index-nav を持つ
  lagging: [
    "deep-dive",
    "atlas-entry",
    "mkt12-weekend",
    "weekly-brief",
    "restart-map",
    "video",
    "event-risk-mobile",
    "latest-articles",
    "turning-point-reserved",
  ],
} as const;

/**
 * data-index-nav 扱いのモジュール (articleId 重複検査から除外 = gate 6)。
 * スマホの Daily Intel・12指標カード + 索引系 (速報リスト / 未来アトラス入口 /
 * 週末12指標 / Weekly Brief / 金融再起動の現在地 / 最新記事)。速報リストは速報帯の 1 本を再掲し得るため
 * 索引扱い。event-risk-mobile は PC の event-risk (本体) のスマホ用の写しなので索引扱い。
 * DeepDiveShelf の featured 1 本は本体扱いのため含めない (残り 4 本の title 行が
 * data-index-nav なのはコンポーネント側で付与する)。
 */
export const INDEX_NAV_MODULES: readonly string[] = [
  "lead-card-mobile",
  "mkt12-card-mobile",
  "flash-list",
  "event-risk-mobile",
  "atlas-entry",
  "mkt12-weekend",
  "weekly-brief",
  "restart-map",
  "funding",
  "latest-articles",
] as const;
