# Intelligence Terminal「切替中」の解消 / 前回リンク / 速報カード撤去 — 設計 (2026-08-23)

Status: `IMPLEMENTATION_GO` (2026-08-23 田平氏 GO — 相談 → 3 点セットで 1 PR)

## 0. 起点

田平氏の相談 (2026-08-23 13:4x):

1. 「現在のセッションは切替中です」が時々出る (朝の 12 指標の時間帯にも)。この空白は必要か
2. 必要なら「前回を読む →」は切り替え前 (= 直前に終わった) のセッションへ飛ぶべきでは
3. 「速報 — 観測から記事へ」はピンとこない。機能として必要か

## 1. 実測 (調査結果の要約)

- セッション窓は producer 側で**連続**定義 (05:03–12:02 / 12:03–18:02 / 18:03–22:32 / 22:33–05:02 — sub-repo `livemakers_export/session_composer.py` `_SESSION_WINDOWS`)。「切替中」という設計上の時間帯は存在しない
- live の条件 = 窓内 **かつ** その窓のアンカー観測 (05:03/12:03/18:03/23:03・07:30 は asia-open の第 2 アンカー) が preflight GREEN で記録されていること。GREEN 記録が無い窓は**レコード自体が無く**、site は `live === null` → `general.noLiveSession`
- 頻度 (8/10–8/23 `lvm_home_observation_cron.log`): Europe Bridge 12:03 RED = 14 日中 6 日 (8/10, 8/11, 8/15, 8/17, 8/22, 8/23) → 12:45–18:45 の 6 時間空白。Asia Open 05:03 RED (07:30 で回復) = 8/17, 8/20 → 05:45–07:45 空白 (= 「朝の 12 指標でも出る」)
- 「次の更新: Europe Bridge Terminal 12:03 JST」が 13:40 でも表示 — `page.tsx` が reviewed packet のセッション + 1 で算出し、時計を見ていない。モバイルの「本日あと N 回更新」も同じ
- 「前回を読む →」= スロットごとに**最新の crystallize 済み (published)** だけを選ぶ (`getTodaySchedule`)。feed 内の当日 closed レコードは対象外 → 8/23 13:40 の Asia Open 行は 8/22 へ飛ぶ
- 速報カード (`FlashPromotionCard`): 昇格ペア (`radarPair`) は **8/8 公開以来一度も非 null になっていない** — feed `promotions: {}` / 記事側 `radarTopicId` 0 本 / radar_state promoted 0 行。構造要因: 表示される観測の topic_id は `dig-*` (session digest 由来) なのに Signal パケットの `radar_topic_id` は `cin-*` (候補クラスタ由来) で結合キーが一致しない
- 観測リストの lane ラベル「X浮上」は producer (`radar_digest_collector.py`) が `x_news_trends` 固定のため、Guardian / Straits Times 等のリンクにも付く

## 2. 決定 (田平氏 GO)

| # | 決定 | 実装 |
|---|---|---|
| A | 空白は不要。**誠実性 (live を偽らない) は維持**しつつ、live が無い間は「直前に終わったセッション」を *終了* として見せる | builder `recentClosed` + `SessionNowCard` closed variant |
| B | 「次の更新」「本日あと N 回更新」は**時計ベース** | `lib/sessions/next-session.ts` + `page.tsx` |
| C | 「前回を読む →」は **feed の当日 closed レコードも対象** (最新の closed) | `getTodaySchedule.previous` の条件を `liveStatus === "closed"` へ |
| D | 速報カード (flash-promotion) を**撤去**。観測リストは残す (一次ソース動線) | 勾配台帳 leading から削除・`radarPair` slot 廃止・copy 整理 |
| E | lane ラベルを実態に合わせる | ja「X・報道で浮上」/ en "Surfaced on X / news"・観測カードの見出し/注記を昇格前提から外す |

## 3. 設計詳細

### A. recentClosed (直前に終わったセッション)

- `buildHomeCompositionProps` が `recentClosed: SessionRecord | null` を返す: `normalized.sessions` のうち `liveStatus === "closed"` かつ `date ∈ {articleCutoffToday, その前日}` で `asOfJst` 最新のもの。`live` の有無に関係なく算出 (描画側で live 優先)
- 前日を含めるのは 00:45–05:02 の global-close 持ち越し (producer v0.4 の唯一の例外) を受けるため。fixture (7/10) のような過去レコードは除外されるので P0-1b の「fixture を live と偽らない」は不変 — 既存の degrade 回帰テスト (`articleCutoffToday: 2026-08-07` + fixture 7/10) は引き続き「切替中」を描く
- `SessionNowCard` に `variant: "live" | "closed"` を追加。closed はバッジ `SESSION · {HH:MM} {closedBadgeSuffix}` ("JST 終了" / "JST closed")・`data-session-state="closed"`。本文 (headline / bullets / editorial / CTA / provenance) は live と同じ
- `LeadingColumn` session-now: `live` → live card / `recentClosed` → closed card / どちらも無し → 従来の fallback 文 (+ 次回更新行)
- **mobile (`CompositeHero` hero-session-line)** も同じ扱い: live 無し + recentClosed あり → ラベル「直前のセッション」+ `{date} · {HH:MM} JST · 終了` (copy `hero.closedSessionLabel` / `hero.closedSuffix`)。mobile は hero が唯一の表現 (D8) なので、ここを放置すると mobile だけ「切替中」が残る
- hero の CTA も **D6 archive 迂回を撤退** (SessionNowCard が 8/23 GO で撤退したのと同じ根拠 — `/sessions/[slug]` は feed 由来レコードを同 URL で描く・archive 一覧は stale)。`composite-hero.test.tsx` の D6 ① を currentUrl 期待へ更新
- provenance: closed カードには `sessionProvenance` を流用できない (live 専用に組まれる) ため、builder が `recentClosedProvenance` も同じ規則 (`feed_today` なら reviewed pair・それ以外 fixture) で組む

### B. 時計ベースの次回更新

- `resolveNextSession(now: Date): { def, date: "today" | "tomorrow" }` — JST HH:MM を `updateTimeLabel` と比較し、最初の未来アンカー。全て過ぎていれば翌日の先頭 (asia-open)
- `countRemainingSessions(now: Date): number` — 今日の未来アンカー数
- `page.tsx`: live があれば従来どおり live + 1 (12:03–12:45 の配信待ち窓で「Europe Bridge 12:03」と出るのは配信待ちの表現として正しい)。live が無ければ時計ベース。`remainingSessions` は常に時計ベース
- ISR `revalidate = 300` なので表示は最大 5 分遅れ (許容)

### C. 前回を読む

- `getTodaySchedule(today, live, records)`: `previous = records.find(slug 一致 && liveStatus === "closed")` (records は asOfJst 降順)。feed 由来 closed は `resolveSessionPageRecord` が feed fallback で同 URL を描く (翌 05:02 まで)。その後は crystallize 済みレコードへ自然に戻る (feed から消えるため)
- compact (mobile) の `firstPrevious` も同じ規則で「直前に終わったセッション」になる

### D. 速報カード撤去

- `REGION_MODULES.leading` = `session-now / schedule / event-risk / radar-observations / focus` (flash-promotion 削除)。CP doctrine `livemakers-interface-light-first-macro-crypto-rwa.md` §4 は**窓単位**の台帳 (1. Live Radar …) でモジュール名を持たず、「Live Radar」は観測カード (radar-observations) として存続するため**改訂不要** (実測 2026-08-23)
- `HomeSlots.radarPair` 廃止。`observing = input.radar` (全観測)。Signal 時系列の除外 (`excludeIds`) も廃止 (描かないペアのために記事を隠さない)。`collectSelectedArticleIds` から radarPair を除く
- `HomeSlotInput.promotions` は wire 契約として受理し続ける (feed v0.x の radar bundle / `resolveHomeRadarSource` の injected 判定が参照) が、描画には使わない
- 削除: `FlashPromotionCard.tsx` / `RadarPromotedCard.tsx` / `tests/components/home/flash-promotion.test.tsx` / copy `radar.sectionTitle` `radar.jointLabel` `radar.promoted`

### E. ラベル

- `radar.lanes.xNews`: ja「X・報道で浮上」/ en "Surfaced on X / news" (lane 名 `x_news_trends` の実態 = X とニュースの両方)
- `radar.observations.title`: ja「速報レーダー — 観測中のタイトル」/ en "Breaking Radar — Titles under observation"
- `radar.observations.note`: ja「観測は一次ソースへ。確認を経たものは Signal として記事になります。」/ en "Observations link to primary sources; confirmed items are published as Signals."

## 4. 非対象 (別件)

- crystallize auto-PR の cron push 失敗 (8/15〜 keychain 到達不可) — 「前回を読む」の翌日以降の連続性に効くが本 PR の範囲外
- producer 側 lane の出自判定 (X vs 報道) / 昇格ペアの結合キー統一 — ペアを本当に出す producer ができた時に別 gate
- Europe Bridge 12:03 の RED 率 (6/14) の原因切り分け (週末 stale vs 平日 provider)

## 5. 実装 as-built (2026-08-23)

- 新規: `lib/sessions/next-session.ts` / `tests/lib/sessions-next-session.test.ts`
- 変更: `lib/sessions/session-content.ts` (previous 規則) / `lib/home/build-home-props.ts` (`recentClosed` + `recentClosedProvenance` + `previousJstDate`) / `components/home/SessionNowCard.tsx` (variant) / `components/home/CompositeHero.tsx` (closed + D6 撤退) / `components/home/columns/LeadingColumn.tsx` / `components/home/HomeComposition.tsx` / `app/[locale]/page.tsx` (時計ベース) / `lib/home/gradient-ledger.ts` / `lib/home/select-home-slots.ts` (radarPair 廃止) / `lib/home/home-copy.ts` / `messages/{ja,en}.json`
- 削除: `components/home/FlashPromotionCard.tsx` / `components/home/RadarPromotedCard.tsx` / `tests/components/home/flash-promotion.test.tsx`
- dev 実測 (worktree・本番 feed 12:45 版のローカルコピーを `LIVEMAKERS_TERMINAL_FEED_URL` で注入・14:2x JST): session-now = `data-session-state="closed"`・「SESSION · 05:03 JST 終了」・スナップショット 07:30・「次の更新: NY Open Terminal 18:03 JST」・CTA `/ja/sessions/2026-08-23-asia-open` / schedule Asia Open 行 + compact → `2026-08-23-asia-open` / 「本日あと2回更新」/ leading modules = session-now, schedule, event-risk, radar-observations, focus / hero = 「直前のセッション … 2026-08-23 · 07:30 JST · 終了」/ 可視テキストに「切替中」なし / console error 0

## 6. 受入

- `npm test` 全 green + `tsc --noEmit` clean
- dev 実測: (i) feed に live 無し + 当日 closed あり → closed カード + 時計ベースの次回更新 (ii) P0-1b degrade → 従来 fallback (iii) schedule の Asia Open 行が当日 closed へリンク (iv) leading に flash-promotion モジュール無し
