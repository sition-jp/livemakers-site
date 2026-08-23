# ホーム中央カラム「Daily Intel」帯 + Signal 前面化 — 設計 (2026-08-23 田平氏 GO B-1)

Status: `DESIGN — AWAITING_REVIEW` (田平氏レビュー後に実装計画へ)

## 1. 背景と診断

- 中央カラム (coincident) は `lead-article` (Daily Intel) → `mkt12-reading` (今朝の12指標) → `signal-timeline` の順で、前 2 つが同じ `LeadArticleCard` (14:3 サムネ + text-xl 見出し + 抜粋 + p-5) で描かれる。カラム幅 ~600px で合計 ≈ 760px を占め、Signal の 1 行目は 1080p ブラウザでフォールド下に落ちる
- 更新頻度 (本番 series ページ実測・8 月): Signal は**平日 5〜7 本/日** (01:00 / 09:00 / 14:00 / 20:00 前後のバースト)。Daily Intel は 07:00 に 1 本、12指標は 08:10 に 1 本
- つまり 1 日の大半で「数時間〜十数時間前の固定物」2 枚が上部を占め、日中 4 回更新される Signal が隠れている。12指標のサムネは毎日同じゲージ絵 (シリーズ一貫性) で、ホーム上の情報量はゼロ
- 2026-08-23 田平氏裁定: **案 B-1** (Daily Intel は小カードで残す・12指標は 1 行) + 追加提案 **1** (Signal ヘッダに鮮度) **3** (Daily Intel の抜粋をホームでは落とす) **4** (12指標はホームでサムネを出さない)。案 C (時間帯で主役交代) と NEW バッジ/日付区切り、モバイル順序は本件の対象外

## 2. 目標と受入基準

- 目標: デスクトップ xl (1280px〜) で **Signal の見出しがカラム上端から ≈ 400px 以内**に来て、900px 表示域に Signal 行が 5 本以上入る
- 受入 (実測): 1280×900 で `[data-column-module="signal-timeline"]` の `getBoundingClientRect().top` が中央カラム上端 + 420px 以内・最初の Signal 行が viewport 内
- 朝刊 2 本の存在は消さない: Daily Intel はサムネ + 見出し (抜粋なし) で残し、12指標は見出し行で残す。週末版 (土曜) と `awaiting` (未公開) の分岐は現行どおり
- gate 6 (articleId 重複検査) と D8 (Daily Intel の単一表現 = `<xl` は hero のみ) を維持する

## 3. 変更内容

### 3-1. 勾配台帳: `lead-article` + `mkt12-reading` → `morning-desk` 1 モジュールに統合

`lib/home/gradient-ledger.ts`

```ts
coincident: ["morning-desk", "signal-timeline", "mkt12-tiles", "lane-values"],
```

- 台帳コメントに「2026-08-23 田平氏 GO B-1: lead-article + mkt12-reading を morning-desk へ統合 (Signal 前面化)」を追記する
- `INDEX_NAV_MODULES` は不変 (morning-desk は本体扱い・Daily Intel と 12指標の 2 本が `data-article-id` を持つ)
- CP doctrine §4 の「窓」台帳はカラム単位の優先順であり本件はカラム内モジュールの統合なので CP 側の改訂は不要。台帳コメント + WORKLOG に記録する

### 3-2. `morning-desk` の描画 (`components/home/columns/CoincidentColumn.tsx`)

1 つの `<section data-morning-desk className="rounded-lg border ... p-4">` に以下を縦に収める (ヘッダ文言は 2026-08-23 田平氏裁定で「Daily Intel」):

```
┌ Daily Intel                                        Daily Intel 一覧 → ┐  ← ヘッダ行 (h3 = familyLabels["daily-intel"] + 右寄せ索引リンク・data-index-nav)
│ [14:3 サムネ]                                                        │
│                                                       08-23 07:00    │  ← LeadArticleCard variant="compact" (hidden xl:block)
│ 📋 Daily Intel 8/23｜交渉は金曜の夜に切れ…                            │     見出しのみ・抜粋なし・family ラベル行なし (ヘッダが担う)
│ ───────────────────────────────────────────────────────────────── │
│ 🔬 8月23日朝のマーケット｜12指標                 12指標アーカイブ → │  ← ArticleRow (サムネなし) + 行右隣にアーカイブ索引リンク
│   [朝の12指標] 08-23 08:10                                            │
└─────────────────────────────────────────────────────────────────────┘
```

- **ヘッダ行** (2026-08-23 田平氏裁定: 「今朝の朝刊」ではなく **「Daily Intel」**): `h3` = `copy.familyLabels["daily-intel"]` (ja「Daily Intel」/ en "Daily Intel"・新 copy key は不要)。右端に `copy.gradient.dailyIntelSeriesLink` を `text-xs font-bold text-accent` で置く (wrapper は `data-index-nav`)。ヘッダには 12指標のリンクを置かない (Daily Intel の名の下に別シリーズの導線を吊るさない)
- **Daily Intel ブロック** (`div.hidden.xl:block`): `LeadArticleCard` に新プロップ `variant?: "full" | "compact"` (既定 `"full"` = 現行描画・他呼び出し面は不変)。`compact` = サムネ (`ArticleThumbnail variant="lead"` 14:3) + 日時 (`font-mono text-[10px]`・右寄せ) + 見出し (`text-lg`・`h2` のまま)。**`excerptJa` を描かない**・**family ラベル行も描かない** (ヘッダの「Daily Intel」が担う・重複回避)・内側 padding を `p-4`。pending 状態 (`labels.pending` / `previous` リンク) は現行と同じ描画。`data-article-id` 維持
  - `<xl` で hidden にするのは Daily Intel ブロックだけ (現行の `lead-article` 全体 hidden と同じ意味論 = D8。hero が見出しを担う)。ヘッダ行と 12指標行はモバイルでも出す (現行の `mkt12-reading` がモバイルでも出るのと同じ)
- **12指標行** (`div[data-mkt12-reading][data-mkt12-variant]`): flex 行 = 左に `div[data-mkt12-role="hero"]` (伸縮)・右に `div[data-mkt12-role="archive-link"][data-index-nav]` (「12指標アーカイブ →」・`text-xs font-bold text-accent whitespace-nowrap`・週末版なら `/articles/series/mkt12-weekend`)。hero 側は公開済なら `ArticleRow` (サムネなし・title + family チップ + 日時・`data-article-id`)、`awaiting` なら現行と同じ小箱 (`awaiting` 文言 + `previous` リンク `data-index-nav`)。週末版 (土曜) は `slots.mkt12.variant === "weekend"` で文言・アーカイブ先を週末系へ切り替える (現行ロジックを移設するだけ)。現行の `h3`「今朝の12指標 / 週末の12指標」見出しは family チップ (「朝の12指標 / 週末の12指標」) が代替するため描かない
- Daily Intel ブロックと 12指標行の間は `border-t border-border-primary` で区切る

### 3-3. Signal ヘッダの鮮度表示 (`components/home/SignalTimeline.tsx` + `lib/home/select-home-slots.ts`)

- `HomeSlots` に **追加フィールド** `signalTimelineSummary: { todayCount: number; latestPublishedLabel: string | null }` を足す (既存フィールドは不変)。`selectHomeSlots` 内で `articleToday` を使って算出する:
  - `todayCount` = `signalTimeline` のうち `publishedAtJst.slice(0, 10) === articleToday` の件数
  - `latestPublishedLabel` = `signalTimeline[0]?.publishedLabel ?? null`
  - builder の入力契約 (D13) は変えない。`now` を持ち込まず `articleToday` だけで決定的に計算する (fixture テストが再現可能)
- `SignalTimeline` の props に `summary` を追加し、ヘッダ行を次の形にする:
  - 左: `h3` 「直近の Signal」 + 同じ行に `font-mono text-[10px] text-text-tertiary` で `· 今日 6 本 · 最新 08-22 19:53`
  - `todayCount === 0` のときは「今日 N 本」セグメントを描かない (honest empty・「今日 0 本」と煽らない)。`latestPublishedLabel` が null (記事ゼロ) のときは「最新」セグメントも描かない
  - 右: 「Signal 一覧 →」を**ヘッダ行の右端に移す** (末尾の独立行は廃止・`data-index-nav` 維持)
  - copy: `gradient.signalTodayCount` (ja「今日 {count} 本」/ en "{count} today")・`gradient.signalLatestAt` (ja「最新 {time}」/ en "latest {time}")。`HomeCopy` は静的文字列の束で `t()` の values を通せないため、`{count}` / `{time}` を含む生文字列のまま載せ、`SignalTimeline` 側で `.replace()` する (ICU は使わない)
  - `todayCount` は `signalTimeline` (= 昇格ペア除外後) を母集団とする。左カラムの FlashPromotion に出ている Signal は数えない (その 1 本は別枠で見えているため)
- ISR: home は feed 配信時に revalidate されるため、Signal が増えるたびに件数・最新時刻が追随する (追加の再検証経路は要らない)

### 3-4. copy (`messages/ja.json` / `messages/en.json` / `lib/home/home-copy.ts`)

| key | ja | en |
|---|---|---|
| `home.gradient.signalTodayCount` | 今日 {count} 本 | {count} today |
| `home.gradient.signalLatestAt` | 最新 {time} | latest {time} |

帯のヘッダは既存の `home.family.daily-intel` (「Daily Intel」) を流用するため新 key なし。
`mkt12.articleTitle` / `articleTitleWeekend` は描画では使わなくなるが、他面参照の有無を確認してから削除は別途 (本件では残す)。

## 4. 変えないもの

- `selectSignalTimeline` (24h 窓・floor 10・昇格ペア除外) と `collectSelectedArticleIds` (gate 6)
- `CompositeHero` (モバイルの Daily Intel 見出し 1 行)・`LeadingColumn`・`LaggingColumn`・`mkt12-tiles`・`lane-values`
- `LeadArticleCard` の既定描画 (`variant` 未指定 = 現行どおり) — 他の呼び出し面に影響しない
- `ArticleRow` / `ArticleThumbRow` / `ArticleCardSmall` の props

## 5. テスト

- `tests/lib/home-gradient-ledger.test.ts`: coincident の期待配列を `["morning-desk", "signal-timeline", "mkt12-tiles", "lane-values"]` に更新
- `tests/components/home/gradient-columns.test.tsx`: 台帳順テストはそのまま通る (REGION_MODULES から導出)。追加:
  - morning-desk 内の `a[data-article-id]` は最大 2 本 (Daily Intel + 12指標) で、`excerptJa` 文字列を含まない。帯内で「Daily Intel」の文字列は `h3` の 1 箇所だけ (compact カードに family ラベル行がない)
  - morning-desk 内に `img` は Daily Intel のサムネ 1 枚のみ (12指標行にサムネなし)
  - Signal ヘッダに `今日 N 本` と `最新 …` が出る / todayCount 0 の fixture では「今日」セグメントが出ない
  - 「Signal 一覧 →」がヘッダ行 (先頭の `a[data-article-id]` より DOM 上で前) にある
- `tests/app/home-gradient-composition.test.tsx`:
  - 「session-now と lead-article は desktop-only」→ `lead-article` を `morning-desk` に置換 (既存の「子孫に hidden xl:block があればよい」判定で Daily Intel ブロックが通る)
  - mkt12 reading テスト 2 本: `data-mkt12-reading` / `data-mkt12-variant` / `data-mkt12-role="hero"` / `archive-link` の hook と roles 順 `["hero", "archive-link"]` は新構造でも維持される (archive-link は 12指標行の右隣)。週末版は `h3` ではなく `data-mkt12-variant="weekend"` + チップ文言「週末の12指標」で検証
- `tests/lib/home-select-signal-timeline.test.ts`: 不変。`signalTimelineSummary` の単体テストは `tests/lib/home-select-home-slots*.test.ts` (既存があればそこへ・無ければ新設) に追加
- 実測: dev server を 1280×900 で開き、§2 の受入基準を `getBoundingClientRect` で確認してスクリーンショットを残す

## 6. 進め方 (ゲート)

1. 本設計の田平氏レビュー → 実装計画 (writing-plans)
2. 実装は worktree `.worktrees/claude-home-morning-desk` (branch `claude/home-morning-desk-b1`)・TDD
3. site Draft PR → 田平氏 merge GO (8/14 Phase 3 GO の順序決定を改訂する変更のため通常ゲート)
4. merge 後: 本番 home の実測 (Signal 位置) を WORKLOG に記録
