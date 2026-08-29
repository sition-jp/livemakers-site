# Home「Daily Intel」帯 + Signal 前面化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ホーム中央カラムの Daily Intel + 今朝の12指標 の大判カード 2 枚を 1 つの薄い「Daily Intel」帯にまとめ、日中 4 回更新される Signal 時系列をフォールド内に引き上げる (spec: `docs/superpowers/specs/2026-08-23-home-morning-desk-design.md`)。

**Architecture:** 勾配台帳 (`REGION_MODULES.coincident`) の `lead-article` + `mkt12-reading` を `morning-desk` 1 モジュールに統合し、`CoincidentColumn` がヘッダ行 (「Daily Intel」+ 一覧リンク) / compact な `LeadArticleCard` (抜粋・family ラベルなし・`<xl` hidden) / サムネなし `ArticleRow` の 12指標行 (右隣にアーカイブリンク) を 1 箱で描く。Signal ヘッダの鮮度 (今日 N 本 · 最新 MM-DD HH:MM) は `selectHomeSlots` が `signalTimelineSummary` を決定的に算出し、`HomeCopyContext` 経由で整形済み文字列を copy に載せる (既存 `schedule.compactBadge` と同じ機構)。

**Tech Stack:** Next.js (App Router, server components) / next-intl / Tailwind / vitest + @testing-library/react (jsdom)。作業ツリー = `/Users/sition/Documents/SITION/DEV/livemakers-site/.worktrees/claude-home-morning-desk` (branch `claude/home-morning-desk-b1`)。**全コマンドはこの worktree で実行する** (`git -C` / `cd` を明示)。

## Global Constraints

- 台帳順 = `coincident: ["morning-desk", "signal-timeline", "mkt12-tiles", "lane-values"]` (spec §3-1)。`INDEX_NAV_MODULES` は不変
- 帯ヘッダ文言 = `copy.familyLabels["daily-intel"]` (ja「Daily Intel」/ en "Daily Intel")。新 copy key は `gradient.signalTodayCount` (ja「今日 {count} 本」/ en "{count} today") と `gradient.signalLatestAt` (ja「最新 {time}」/ en "latest {time}") の 2 つだけ
- Daily Intel ブロックだけ `hidden xl:block` (D8: `<xl` は hero が見出しを担う)。ヘッダ行と 12指標行は全 breakpoint で表示
- gate 6: `collectSelectedArticleIds` は不変 (Daily Intel と 12指標の 2 本が `data-article-id` 本体)。`selectSignalTimeline` (24h 窓・floor 10) は不変
- `LeadArticleCard` の既定 (`variant` 未指定 = `"full"`) は現行描画のまま。他の呼び出し面 (`DeepDiveShelf` 等) に影響させない
- `latestAt` 形式 = `publishedAtJst.slice(5, 16).replace("T", " ")` → `07-10 08:30`。`publishedLabel` (`… 公開` 付き) は使わない
- `todayCount === 0` → セグメント非表示 (honest empty)。記事ゼロ → `latestAt` 非表示
- 1 commit = 1 論理変更。`git add` は対象ファイルを個別指定 (`git add .` 禁止)。commit 末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- テストは `npx vitest run <file>` で単体実行、最後に `npm test` + `npm run typecheck` を全通し

---

## File Structure

| ファイル | 責務 | 変更 |
|---|---|---|
| `lib/home/gradient-ledger.ts` | 台帳 (モジュール順の正本) | `coincident` 配列 + コメント |
| `lib/home/select-home-slots.ts` | slot 選定 (純関数) | `HomeSlots.signalTimelineSummary` 追加 + 算出 |
| `lib/home/home-copy.ts` | copy 型 + builder | `HomeCopyContext` 2 項 / `gradient.signalFreshness` / `buildTestHomeCopy(overrides?)` |
| `messages/ja.json` / `messages/en.json` | 文言 | `home.gradient.signalTodayCount` / `signalLatestAt` |
| `app/[locale]/page.tsx` | copy context 組立 | `signalTodayCount` / `signalLatestAt` を渡す |
| `components/home/LeadArticleCard.tsx` | Daily Intel カード | `variant="compact"` 追加 |
| `components/home/SignalTimeline.tsx` | Signal 時系列 | ヘッダ行 (鮮度 + 一覧リンク右端) |
| `components/home/columns/CoincidentColumn.tsx` | 中央カラム描画 | `morning-desk` ケース (lead-article / mkt12-reading ケースを置換) |
| `tests/lib/home-gradient-ledger.test.ts` | 台帳テスト | 期待配列 |
| `tests/lib/home-select-slots.test.ts` | slot テスト | summary 2 件追加 |
| `tests/lib/home-copy-signal-freshness.test.ts` | copy builder テスト (新規) | 整形 / null 分岐 |
| `tests/components/home/lead-group.test.tsx` | LeadArticleCard テスト | compact 1 件追加 |
| `tests/components/home/signal-timeline.test.tsx` | SignalTimeline テスト | ヘッダ鮮度 + リンク位置 |
| `tests/components/home/gradient-columns.test.tsx` | カラム描画テスト | morning-desk 3 件追加 |
| `tests/app/home-gradient-composition.test.tsx` | 組成テスト | `lead-article`→`morning-desk`・mkt12 reading 2 件更新 |

---

### Task 1: 台帳 — `lead-article` + `mkt12-reading` → `morning-desk`

**Files:**
- Modify: `lib/home/gradient-ledger.ts:24-26`
- Test: `tests/lib/home-gradient-ledger.test.ts:18-20`

**Interfaces:**
- Produces: `REGION_MODULES.coincident === ["morning-desk", "signal-timeline", "mkt12-tiles", "lane-values"]` (Task 6 の `CoincidentColumn` がこの id で `case "morning-desk"` を描く)

- [ ] **Step 1: 台帳テストの期待を更新する**

`tests/lib/home-gradient-ledger.test.ts` の `coincident` 期待を差し替える:

```ts
    // 2026-08-23 田平氏 GO B-1: lead-article + mkt12-reading を morning-desk
    // (「Daily Intel」帯) へ統合し、signal-timeline を前面化。
    expect(REGION_MODULES.coincident).toEqual([
      "morning-desk", "signal-timeline", "mkt12-tiles", "lane-values",
    ]);
```

- [ ] **Step 2: 失敗を確認する**

Run: `cd /Users/sition/Documents/SITION/DEV/livemakers-site/.worktrees/claude-home-morning-desk && npx vitest run tests/lib/home-gradient-ledger.test.ts`
Expected: FAIL — `expected [ 'lead-article', 'mkt12-reading', … ] to deeply equal [ 'morning-desk', … ]`

- [ ] **Step 3: 台帳を書き換える**

`lib/home/gradient-ledger.ts` の `coincident` 行とコメントを差し替える:

```ts
  // - coincident: mkt12-reading (今朝の12指標) を lead-article 直下へ
  // 2026-08-23 田平氏 GO B-1 (Signal 前面化): lead-article + mkt12-reading を
  //   morning-desk (「Daily Intel」帯 = compact な Daily Intel + サムネなし 12指標行)
  //   1 モジュールへ統合。Daily Intel ブロックだけ <xl hidden (D8・hero が担う)。
  //   spec: docs/superpowers/specs/2026-08-23-home-morning-desk-design.md
  coincident: ["morning-desk", "signal-timeline", "mkt12-tiles", "lane-values"],
```

- [ ] **Step 4: 台帳テストが通ることを確認する**

Run: `npx vitest run tests/lib/home-gradient-ledger.test.ts`
Expected: PASS (3 tests)。※ この時点で `gradient-columns` / `home-gradient-composition` は `morning-desk` が未描画のため FAIL する — Task 6 で解消する (既知・commit は台帳単位で切る)

- [ ] **Step 5: Commit**

```bash
git add lib/home/gradient-ledger.ts tests/lib/home-gradient-ledger.test.ts
git commit -m "feat(home): 勾配台帳 coincident を morning-desk 統合順へ (2026-08-23 田平氏 GO B-1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `selectHomeSlots` — `signalTimelineSummary`

**Files:**
- Modify: `lib/home/select-home-slots.ts:21-49` (型) / `:154-160` (算出) / `:184-196` (return)
- Test: `tests/lib/home-select-slots.test.ts` (`"supplies the signal timeline excluding the promoted pair"` の直後に追加)

**Interfaces:**
- Produces: `HomeSlots.signalTimelineSummary: { todayCount: number; latestAt: string | null }` (Task 3 の `page.tsx` が context に渡す)

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/home-select-slots.test.ts` の `it("supplies the signal timeline excluding the promoted pair", …)` の直後に追加:

```ts
  // fixture: 2026-07-10 の Signal は cbdc-pilot-expansion (08:30) と
  // stablecoin-supply (06:10) の 2 本。input() は stablecoin を昇格ペアに
  // しているため timeline から除外され、今日の件数は 1。
  it("summarizes the signal timeline (today count + latest MM-DD HH:MM) for the header", () => {
    const slots = selectHomeSlots(input());
    expect(slots.signalTimelineSummary).toEqual({
      todayCount: 1,
      latestAt: "07-10 08:30",
    });
  });

  it("summarizes honestly when no signal is from today or none exists", () => {
    const noToday = selectHomeSlots({
      ...input(),
      promotions: {},
      articles: input().articles.filter(
        (article) =>
          article.family !== "signal" || !article.publishedAtJst.startsWith("2026-07-10"),
      ),
    });
    expect(noToday.signalTimelineSummary.todayCount).toBe(0);
    expect(noToday.signalTimelineSummary.latestAt).toBe("07-09 22:10");
    const noSignals = selectHomeSlots({
      ...input(),
      promotions: {},
      articles: input().articles.filter((article) => article.family !== "signal"),
    });
    expect(noSignals.signalTimelineSummary).toEqual({ todayCount: 0, latestAt: null });
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/lib/home-select-slots.test.ts`
Expected: FAIL — `expected undefined to deeply equal { todayCount: 1, latestAt: '07-10 08:30' }`

- [ ] **Step 3: 型と算出を実装する**

`lib/home/select-home-slots.ts` — `HomeSlots` の `signalTimeline: ArticleMeta[];` の直後に追加:

```ts
  // 2026-08-23 田平氏 GO B-1 (追加提案 1): Signal ヘッダの鮮度表示用。
  // todayCount = signalTimeline (昇格ペア除外後) のうち articleToday 公開の本数 /
  // latestAt = 先頭記事の publishedAtJst を MM-DD HH:MM へ (記事ゼロは null)。
  // now を持ち込まず articleToday だけで決定的に算出する (D13)。
  signalTimelineSummary: {
    todayCount: number;
    latestAt: string | null;
  };
```

`selectHomeSlots` の `signalTimeline` 算出 (`.map((article) => take(article) as ArticleMeta);`) の直後に追加:

```ts
  const signalTimelineSummary: HomeSlots["signalTimelineSummary"] = {
    todayCount: signalTimeline.filter((article) => dateOf(article) === articleToday)
      .length,
    latestAt: signalTimeline[0]
      ? signalTimeline[0].publishedAtJst.slice(5, 16).replace("T", " ")
      : null,
  };
```

return オブジェクトの `signalTimeline,` の直後に `signalTimelineSummary,` を足す。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/lib/home-select-slots.test.ts`
Expected: PASS (全件)。続けて `npm run typecheck` — `HomeSlots` をリテラルで組む箇所があれば `signalTimelineSummary` 欠落で落ちる。落ちた箇所には `signalTimelineSummary: { todayCount: 0, latestAt: null }` を足す (現状 `selectHomeSlots` の return 以外に組立箇所は無い想定)

- [ ] **Step 5: Commit**

```bash
git add lib/home/select-home-slots.ts tests/lib/home-select-slots.test.ts
git commit -m "feat(home): selectHomeSlots に signalTimelineSummary (今日の本数 + 最新時刻) を追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: copy — `gradient.signalFreshness` (ja/en key + `HomeCopyContext` + page 配線)

**Files:**
- Modify: `messages/ja.json:426-437` / `messages/en.json:426-437`
- Modify: `lib/home/home-copy.ts:15-20` (context) / `:46-57` (型) / `:136-147` (builder) / `:261-268` (`buildTestHomeCopy`)
- Modify: `app/[locale]/page.tsx:31-45`
- Create: `tests/lib/home-copy-signal-freshness.test.ts`

**Interfaces:**
- Consumes: `HomeSlots.signalTimelineSummary` (Task 2)
- Produces: `HomeCopy.gradient.signalFreshness: { todayCount: string | null; latestAt: string | null }` / `HomeCopyContext.signalTodayCount: number` / `HomeCopyContext.signalLatestAt: string | null` / `buildTestHomeCopy(overrides?: Partial<HomeCopyContext>)` (Task 5・6 が使う)

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/home-copy-signal-freshness.test.ts` を新規作成:

```ts
import { describe, expect, it } from "vitest";

import { buildTestHomeCopy } from "@/lib/home/home-copy";

describe("home copy: signal freshness (2026-08-23 田平氏 GO B-1 追加提案 1)", () => {
  it("formats today's count and the latest stamp from the context", () => {
    const copy = buildTestHomeCopy({ signalTodayCount: 6, signalLatestAt: "08-22 19:53" });
    expect(copy.gradient.signalFreshness).toEqual({
      todayCount: "今日 6 本",
      latestAt: "最新 08-22 19:53",
    });
  });

  it("drops the segments honestly when there is nothing to say", () => {
    const copy = buildTestHomeCopy({ signalTodayCount: 0, signalLatestAt: null });
    expect(copy.gradient.signalFreshness).toEqual({ todayCount: null, latestAt: null });
  });

  it("defaults the test context to the fixture day (2 signals on 2026-07-10)", () => {
    expect(buildTestHomeCopy().gradient.signalFreshness).toEqual({
      todayCount: "今日 2 本",
      latestAt: "最新 07-10 08:30",
    });
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/lib/home-copy-signal-freshness.test.ts`
Expected: FAIL — `buildTestHomeCopy` が引数を受けず `signalFreshness` が undefined

- [ ] **Step 3: copy key を足す**

`messages/ja.json` の `"gradient"` ブロック末尾 (`"deepDiveSeriesLink": "Deep Dive 一覧 →"` の行) を:

```json
      "deepDiveSeriesLink": "Deep Dive 一覧 →",
      "signalTodayCount": "今日 {count} 本",
      "signalLatestAt": "最新 {time}"
```

`messages/en.json` の同箇所を:

```json
      "deepDiveSeriesLink": "All Deep Dives →",
      "signalTodayCount": "{count} today",
      "signalLatestAt": "latest {time}"
```

- [ ] **Step 4: 型と builder を実装する**

`lib/home/home-copy.ts`:

`HomeCopyContext` に追加:

```ts
export interface HomeCopyContext {
  sessionName: string;
  nextSessionName: string;
  nextSessionTime: string;
  remainingSessions: number;
  /** 2026-08-23 GO B-1: Signal ヘッダ鮮度 (slots.signalTimelineSummary 由来) */
  signalTodayCount: number;
  signalLatestAt: string | null;
}
```

`HomeCopy.gradient` 型に追加 (`atlasHeadingPublished: string;` の直後):

```ts
    // 整形済み文字列 (null = そのセグメントを描かない・honest empty)
    signalFreshness: {
      todayCount: string | null;
      latestAt: string | null;
    };
```

`buildHomeCopy` の `gradient: { … atlasHeadingPublished: translate("gradient.atlasHeadingPublished"),` の直後に追加:

```ts
      signalFreshness: {
        todayCount:
          context.signalTodayCount > 0
            ? translate("gradient.signalTodayCount", {
                count: context.signalTodayCount,
              })
            : null,
        latestAt: context.signalLatestAt
          ? translate("gradient.signalLatestAt", { time: context.signalLatestAt })
          : null,
      },
```

`buildTestHomeCopy` を overrides 付きに:

```ts
export function buildTestHomeCopy(
  overrides: Partial<HomeCopyContext> = {},
): HomeCopy {
  return buildHomeCopy(testTranslator, {
    sessionName: "Asia Open Terminal",
    nextSessionName: "Europe Bridge Terminal",
    nextSessionTime: "12:03",
    remainingSessions: 3,
    // fixture 2026-07-10 の Signal 2 本 (cbdc 08:30 / stablecoin 06:10) に一致
    signalTodayCount: 2,
    signalLatestAt: "07-10 08:30",
    ...overrides,
  });
}
```

- [ ] **Step 5: page.tsx に配線する**

`app/[locale]/page.tsx` の `buildHomeCopy(` 第 2 引数 `remainingSessions: … .length,` の直後に追加:

```ts
      signalTodayCount: props.slots.signalTimelineSummary.todayCount,
      signalLatestAt: props.slots.signalTimelineSummary.latestAt,
```

- [ ] **Step 6: テストと typecheck が通ることを確認する**

Run: `npx vitest run tests/lib/home-copy-signal-freshness.test.ts && npm run typecheck`
Expected: PASS (3 tests) / typecheck exit 0

- [ ] **Step 7: Commit**

```bash
git add messages/ja.json messages/en.json lib/home/home-copy.ts "app/[locale]/page.tsx" tests/lib/home-copy-signal-freshness.test.ts
git commit -m "feat(home): Signal ヘッダ鮮度の copy (今日 N 本 / 最新 MM-DD HH:MM) を HomeCopyContext 経由で整形

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `LeadArticleCard` — `variant="compact"`

**Files:**
- Modify: `components/home/LeadArticleCard.tsx`
- Test: `tests/components/home/lead-group.test.tsx` (末尾に 1 件追加)

**Interfaces:**
- Produces: `LeadArticleCard` props に `variant?: "full" | "compact"` (既定 `"full"`)。compact = サムネ (`ArticleThumbnail variant="lead"`) + 右寄せ日時 + `h2.text-lg` 見出し。`excerptJa` と family ラベルを描かない。`data-article-id` 維持 (Task 6 が使う)

- [ ] **Step 1: 失敗するテストを書く**

`tests/components/home/lead-group.test.tsx` の最後の `it(…)` の後 (describe 内) に追加:

```ts
  it("renders the compact variant without excerpt or family label (2026-08-23 GO B-1)", () => {
    const { container } = render(
      <LeadArticleCard
        variant="compact"
        slot={{
          state: "today",
          previous: null,
          article: {
            articleId: "daily-intel-2026-07-10",
            family: "daily-intel",
            titleJa: "📋 朝刊 7/10｜テスト見出し",
            excerptJa: "この抜粋は compact では描かれない",
            href: "/articles/daily-intel-2026-07-10",
            publishedAtJst: "2026-07-10T07:00:00+09:00",
            publishedLabel: "07-10 07:00 公開",
            lanes: [],
          } as never,
        }}
        labels={{
          pending: "記事化待ち",
          pendingNote: "朝刊の公開準備中です",
          previous: "前回の記事を読む →",
          family: "Daily Intel",
        }}
      />,
    );
    const card = container.querySelector("a[data-article-id]")!;
    expect(card.getAttribute("data-article-id")).toBe("daily-intel-2026-07-10");
    expect(card.textContent).not.toContain("この抜粋は compact では描かれない");
    // family ラベル行なし (帯ヘッダが担う)
    expect(
      [...card.querySelectorAll("span")].some((span) => span.textContent === "Daily Intel"),
    ).toBe(false);
    expect(card.textContent).toContain("07-10 07:00 公開");
    const heading = card.querySelector("h2")!;
    expect(heading.textContent).toBe("📋 朝刊 7/10｜テスト見出し");
    expect(heading.className).toContain("text-lg");
    expect(card.querySelector("[data-article-thumbnail]")).not.toBeNull();
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/components/home/lead-group.test.tsx`
Expected: FAIL — 抜粋テキスト / family ラベルが描かれている (`expected … not to contain …`)

- [ ] **Step 3: compact を実装する**

`components/home/LeadArticleCard.tsx` の関数を次に置き換える (pending 分岐は不変):

```tsx
export function LeadArticleCard({
  slot,
  labels,
  headingLevel = "h2",
  variant = "full",
}: {
  slot: HomeSlots["lead"];
  labels: LeadArticleLabels;
  headingLevel?: "h2" | "h4";
  /**
   * "full" = 現行 (14:3 サムネ + family ラベル + text-xl 見出し + 抜粋・p-5)。
   * "compact" (2026-08-23 GO B-1) = 「Daily Intel」帯用。family ラベル行と
   * 抜粋を描かず、日時 + text-lg 見出しのみ・p-4。帯ヘッダが家族名を担う。
   */
  variant?: "full" | "compact";
}) {
  if (!slot.article) {
    /* …現行の pending 分岐そのまま… */
  }

  const article = slot.article;
  const Heading = headingLevel;
  const compact = variant === "compact";
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      data-lead-variant={variant}
      className="group block overflow-hidden rounded-lg border border-border-primary bg-bg-secondary transition-colors hover:border-border-hover"
    >
      <ArticleThumbnail
        thumbnailUrl={article.thumbnailUrl}
        family={article.family}
        title={article.titleJa}
        variant="lead"
      />
      <div className={compact ? "p-4" : "p-5"}>
        <div className="flex items-center justify-between gap-3">
          {compact ? (
            <span />
          ) : (
            <span
              className="text-[10px] font-bold tracking-label"
              style={{ color: FAMILY_COLORS[article.family] }}
            >
              {labels.family}
            </span>
          )}
          <time className="font-mono text-[10px] text-text-tertiary">
            {article.publishedLabel}
          </time>
        </div>
        <Heading
          className={`${compact ? "mt-2 text-lg" : "mt-3 text-xl"} font-bold leading-snug text-text-primary group-hover:underline`}
        >
          {article.titleJa}
        </Heading>
        {!compact && article.excerptJa ? (
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {article.excerptJa}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/components/home/lead-group.test.tsx tests/components/home/gradient-columns.test.tsx`
Expected: `lead-group` PASS。`gradient-columns` は Task 1 由来の morning-desk 未描画で FAIL のまま (Task 6 で解消)

- [ ] **Step 5: Commit**

```bash
git add components/home/LeadArticleCard.tsx tests/components/home/lead-group.test.tsx
git commit -m "feat(home): LeadArticleCard に compact variant (抜粋・family ラベルなし・text-lg) を追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `SignalTimeline` — ヘッダ鮮度 + 一覧リンクをヘッダ右端へ

**Files:**
- Modify: `components/home/SignalTimeline.tsx`
- Test: `tests/components/home/signal-timeline.test.tsx`

**Interfaces:**
- Consumes: `HomeCopy.gradient.signalFreshness` (Task 3)
- Produces: `SignalTimelineCopy` に `freshness: { todayCount: string | null; latestAt: string | null }` 追加。DOM: `[data-signal-freshness="today"|"latest"]` span / 「Signal 一覧 →」はヘッダ行 (最初の `a[data-article-id]` より DOM 前)

- [ ] **Step 1: テストを書き換える**

`tests/components/home/signal-timeline.test.tsx` の `const copy = {…}` を:

```ts
const copy = {
  title: buildTestHomeCopy().gradient.signalTitle,
  familyLabels: buildTestHomeCopy().familyLabels,
  seriesLink: buildTestHomeCopy().gradient.signalSeriesLink,
  freshness: buildTestHomeCopy().gradient.signalFreshness,
};
```

既存の `it("links to the signal series index at the bottom", …)` を次に置き換え、さらに 2 件足す:

```ts
  it("links to the signal series index in the header, before the first row (2026-08-23 GO B-1)", () => {
    const { container } = render(
      <SignalTimeline articles={[article({ articleId: "s1" })]} copy={copy} />,
    );
    const link = container.querySelector('a[href="/articles/series/signal"]')!;
    expect(link).not.toBeNull();
    expect(link.closest("[data-index-nav]")).not.toBeNull();
    const firstRow = container.querySelector("a[data-article-id]")!;
    expect(
      link.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows today's count and the latest stamp next to the title", () => {
    const { container } = render(
      <SignalTimeline articles={[article({ articleId: "s1" })]} copy={copy} />,
    );
    expect(
      container.querySelector('[data-signal-freshness="today"]')?.textContent,
    ).toContain("今日 2 本");
    expect(
      container.querySelector('[data-signal-freshness="latest"]')?.textContent,
    ).toContain("最新 07-10 08:30");
  });

  it("omits freshness segments that are null (honest empty)", () => {
    const { container } = render(
      <SignalTimeline
        articles={[article({ articleId: "s1" })]}
        copy={{ ...copy, freshness: { todayCount: null, latestAt: "最新 07-09 22:10" } }}
      />,
    );
    expect(container.querySelector('[data-signal-freshness="today"]')).toBeNull();
    expect(
      container.querySelector('[data-signal-freshness="latest"]')?.textContent,
    ).toContain("最新 07-09 22:10");
    expect(container.textContent).not.toContain("今日 0 本");
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/components/home/signal-timeline.test.tsx`
Expected: FAIL — `[data-signal-freshness="today"]` が null / リンクが末尾

- [ ] **Step 3: コンポーネントを実装する**

`components/home/SignalTimeline.tsx` を次に置き換える:

```tsx
import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleThumbRow } from "./ArticleThumbRow";

export interface SignalTimelineCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
  seriesLink: string;
  /** 整形済み (null = 描かない)。HomeCopy.gradient.signalFreshness 由来 */
  freshness: {
    todayCount: string | null;
    latestAt: string | null;
  };
}

/**
 * 中央カラム Signal 時系列 (G44 D6 / 2026-08-14 Phase 3b 改訂 / 2026-08-23 GO B-1)。
 * slots.signalTimeline の全行を小サムネ付き行 (ArticleThumbRow) で描画する
 * (本体扱い・data-article-id・索引扱いにしない)。選定 (直近 24h・floor 10・
 * 昇格ペア除外) は selectSignalTimeline / selectHomeSlots が担い、本
 * コンポーネントは表示のみ。ヘッダ行 = 見出し + 鮮度 (今日 N 本 · 最新 MM-DD HH:MM・
 * null セグメントは描かない) + 右端にシリーズ一覧リンク (索引)。
 */
export function SignalTimeline({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: SignalTimelineCopy;
}) {
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
          {copy.freshness.todayCount ? (
            <span
              data-signal-freshness="today"
              className="font-mono text-[10px] text-text-tertiary"
            >
              · {copy.freshness.todayCount}
            </span>
          ) : null}
          {copy.freshness.latestAt ? (
            <span
              data-signal-freshness="latest"
              className="font-mono text-[10px] text-text-tertiary"
            >
              · {copy.freshness.latestAt}
            </span>
          ) : null}
        </div>
        <div data-index-nav className="shrink-0">
          <Link
            href="/articles/series/signal"
            className="whitespace-nowrap text-xs font-bold text-accent"
          >
            {copy.seriesLink}
          </Link>
        </div>
      </div>
      <div className="mt-2 border-t border-border-primary">
        {articles.map((article) => (
          <ArticleThumbRow
            key={article.articleId}
            article={article}
            familyLabel={copy.familyLabels[article.family]}
          />
        ))}
      </div>
    </section>
  );
}
```

`components/home/columns/CoincidentColumn.tsx` の `case "signal-timeline"` の copy に `freshness: copy.gradient.signalFreshness,` を足す (この 1 行だけ先に入れる — Task 6 で同ファイルを本格改修する)。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/components/home/signal-timeline.test.tsx && npm run typecheck`
Expected: PASS (4 tests) / typecheck exit 0

- [ ] **Step 5: Commit**

```bash
git add components/home/SignalTimeline.tsx components/home/columns/CoincidentColumn.tsx tests/components/home/signal-timeline.test.tsx
git commit -m "feat(home): Signal ヘッダに鮮度 (今日 N 本 · 最新 MM-DD HH:MM) と一覧リンク右端配置

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `CoincidentColumn` — `morning-desk` 描画 + 組成テスト更新

**Files:**
- Modify: `components/home/columns/CoincidentColumn.tsx` (`case "lead-article"` / `case "mkt12-reading"` / `MODULE_CLASSNAMES` を置換)
- Test: `tests/components/home/gradient-columns.test.tsx` (CoincidentColumn describe に 3 件追加)
- Test: `tests/app/home-gradient-composition.test.tsx:115-130` / `:149-166` / `:167-200`

**Interfaces:**
- Consumes: `REGION_MODULES.coincident` (Task 1) / `LeadArticleCard variant="compact"` (Task 4) / `copy.gradient.signalFreshness` (Task 5)
- Produces: DOM hooks `section[data-morning-desk]` / `[data-morning-desk-role="daily-intel"]` (`hidden xl:block`) / `[data-mkt12-reading][data-mkt12-variant]` / `[data-mkt12-role="hero"]` → `[data-mkt12-role="archive-link"]` の順

- [ ] **Step 1: カラムテストを書く**

`tests/components/home/gradient-columns.test.tsx` の `describe("CoincidentColumn …")` 内 (`it("renders the signal timeline with at least the floor of ten rows"` の直前) に追加:

```ts
  // 2026-08-23 田平氏 GO B-1: 「Daily Intel」帯 = compact Daily Intel + サムネなし 12指標行
  it("renders the morning desk as one band: Daily Intel header, compact lead, thumb-less mkt12 row", () => {
    const { container } = renderCoincident();
    const desk = container.querySelector(
      '[data-column-module="morning-desk"] [data-morning-desk]',
    )!;
    expect(desk).not.toBeNull();
    // ヘッダ = 「Daily Intel」(h3 は帯に 1 つだけ)
    expect(desk.querySelectorAll("h3")).toHaveLength(1);
    expect(desk.querySelector("h3")?.textContent).toBe(copy.familyLabels["daily-intel"]);
    // 本体 2 本 (Daily Intel + 12指標)・抜粋なし
    const bodies = desk.querySelectorAll("a[data-article-id]");
    expect([...bodies].map((a) => a.getAttribute("data-article-id"))).toEqual([
      "daily-intel-2026-07-10",
      "mkt12-morning-2026-07-10",
    ]);
    expect(desk.textContent).not.toContain(props.slots.lead.article!.excerptJa!);
    // サムネは Daily Intel の 1 枚だけ (12指標行はサムネなし)
    expect(desk.querySelectorAll("[data-article-thumbnail]")).toHaveLength(1);
    expect(desk.querySelectorAll("img").length).toBeLessThanOrEqual(1);
    // Daily Intel ブロックだけ <xl hidden (D8)
    const lead = desk.querySelector('[data-morning-desk-role="daily-intel"]')!;
    expect(lead.classList.contains("hidden")).toBe(true);
    expect(lead.classList.contains("xl:block")).toBe(true);
    expect(lead.querySelector('[data-lead-variant="compact"]')).not.toBeNull();
    // compact カードに family ラベル行は無い (帯ヘッダが担う)
    expect(
      [...lead.querySelectorAll("span")].some((span) => span.textContent === copy.lead.family),
    ).toBe(false);
    // 索引リンク: Daily Intel 一覧はヘッダ・12指標アーカイブは行の右隣
    const intelLink = desk.querySelector('a[href="/articles/series/daily-intel"]')!;
    expect(intelLink.closest("[data-index-nav]")).not.toBeNull();
    const mkt12Link = desk.querySelector(
      '[data-mkt12-role="archive-link"] a[href="/articles/series/mkt12-morning"]',
    )!;
    expect(mkt12Link.closest("[data-index-nav]")).not.toBeNull();
    expect(
      intelLink.compareDocumentPosition(lead) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the mkt12 row thumb-less and labelled by its family chip", () => {
    const { container } = renderCoincident();
    const row = container.querySelector('[data-mkt12-reading] [data-mkt12-role="hero"] a[data-article-id]')!;
    expect(row.getAttribute("data-article-id")).toBe("mkt12-morning-2026-07-10");
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector('[data-testid="article-row-chip"]')?.textContent).toBe(
      copy.familyLabels["mkt12-morning"],
    );
  });

  it("puts the signal timeline right after the morning desk", () => {
    const { container } = renderCoincident();
    const modules = [...container.querySelectorAll("[data-column-module]")].map((el) =>
      el.getAttribute("data-column-module"),
    );
    expect(modules.slice(0, 2)).toEqual(["morning-desk", "signal-timeline"]);
  });
```

- [ ] **Step 2: 組成テストを更新する**

`tests/app/home-gradient-composition.test.tsx`:

(a) `it("keeps session-now and lead-article desktop-only …")` の配列を `["session-now", "morning-desk"]` に、テスト名を `"keeps session-now and the morning desk's Daily Intel block desktop-only (single representation)"` に変更 (判定ロジックは既存のまま — 子孫 `[data-morning-desk-role="daily-intel"]` が `hidden xl:block` を持つので通る)。

(b) `it("renders the mkt12 reading as latest-only + archive link (Phase 3, 2026-08-14)")` はそのまま残す (roles 順 `["hero", "archive-link"]`・archive href は新構造でも同じ)。テスト名末尾に ` / 2026-08-23 GO B-1: サムネなし行` を添える。

(c) 週末テスト `it("switches the mkt12 reading to the weekend variant on Saturday")` の

```ts
    expect(reading.querySelector("h3")?.textContent).toBe("週末の12指標");
```

を次に置き換える (h3 は廃止・awaiting 箱の文言で週末系を確認):

```ts
    // 2026-08-23 GO B-1: 見出し h3 は廃止。週末系は awaiting 文言 + previous リンクで判定
    expect(reading.textContent).toContain(copy.mkt12.awaitingWeekend);
    expect(reading.textContent).toContain(copy.mkt12.previousWeekend);
```

- [ ] **Step 3: 失敗を確認する**

Run: `npx vitest run tests/components/home/gradient-columns.test.tsx tests/app/home-gradient-composition.test.tsx`
Expected: FAIL — `[data-column-module="morning-desk"]` の中身が空 (`renderModule` が `null` を返す)

- [ ] **Step 4: `CoincidentColumn` を実装する**

`components/home/columns/CoincidentColumn.tsx`:

import に `ArticleRow` を追加:

```tsx
import { ArticleRow } from "../ArticleRow";
```

`MODULE_CLASSNAMES` を空にする (Daily Intel の `<xl` hidden は帯内部へ移る):

```tsx
const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {};
```

JSDoc を更新:

```tsx
/**
 * 中央カラム = 一致 (G44 D6 / 2026-08-14 Phase 3 改訂 / 2026-08-23 GO B-1)。
 * モジュール順は勾配台帳 REGION_MODULES.coincident。morning-desk = 「Daily Intel」帯
 * (ヘッダ「Daily Intel」+ 一覧リンク / compact Daily Intel = D8 で desktop 専用・
 * mobile は CompositeHero が担う / サムネなし 12指標行 + 行右隣にアーカイブリンク)。
 * 直下に signal-timeline (Signal 前面化)。
 */
```

`case "lead-article":` と `case "mkt12-reading":` の 2 ケースを削除し、代わりに次を置く:

```tsx
      case "morning-desk": {
        // 2026-08-23 田平氏 GO B-1: lead-article + mkt12-reading を 1 帯に統合。
        // ヘッダ文言は familyLabels["daily-intel"] (「Daily Intel」・田平氏裁定)。
        // 2026-08-15 GO 継承: 土曜は variant="weekend" (文言・アーカイブ先を週末系へ)。
        const isWeekend = slots.mkt12.variant === "weekend";
        const mkt12Text = isWeekend
          ? {
              awaiting: copy.mkt12.awaitingWeekend,
              previous: copy.mkt12.previousWeekend,
              archiveHref: "/articles/series/mkt12-weekend",
            }
          : {
              awaiting: copy.mkt12.awaiting,
              previous: copy.mkt12.previous,
              archiveHref: "/articles/series/mkt12-morning",
            };
        return (
          <section
            data-morning-desk
            className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-bold text-text-primary">
                {familyLabels["daily-intel"]}
              </h3>
              <div data-index-nav className="shrink-0">
                <Link
                  href="/articles/series/daily-intel"
                  className="whitespace-nowrap text-xs font-bold text-accent"
                >
                  {copy.gradient.dailyIntelSeriesLink}
                </Link>
              </div>
            </div>
            {/* D8: Daily Intel の単一表現 — <xl は CompositeHero が見出しを担う */}
            <div
              data-morning-desk-role="daily-intel"
              className="mt-3 hidden xl:block"
            >
              <LeadArticleCard
                slot={slots.lead}
                labels={copy.lead}
                variant="compact"
              />
            </div>
            <div
              data-mkt12-reading
              data-mkt12-variant={slots.mkt12.variant}
              className="mt-3 flex items-start justify-between gap-3 border-t border-border-primary"
            >
              <div data-mkt12-role="hero" className="min-w-0 flex-1">
                {slots.mkt12.article ? (
                  <ArticleRow
                    article={slots.mkt12.article}
                    familyLabel={familyLabels[slots.mkt12.article.family]}
                  />
                ) : (
                  <div className="mt-2 rounded bg-bg-tertiary p-3 text-xs text-text-secondary">
                    <p>{mkt12Text.awaiting}</p>
                    {slots.mkt12.previous ? (
                      <div data-index-nav className="mt-2">
                        <Link
                          href={slots.mkt12.previous.href}
                          className="font-bold text-accent"
                        >
                          {mkt12Text.previous}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div
                data-mkt12-role="archive-link"
                data-index-nav
                className="shrink-0 pt-2.5"
              >
                <Link
                  href={mkt12Text.archiveHref}
                  className="whitespace-nowrap text-xs font-bold text-accent"
                >
                  {copy.mkt12.archiveLink}
                </Link>
              </div>
            </div>
          </section>
        );
      }
```

(`case "signal-timeline"` には Task 5 で `freshness` が入っている。`case "mkt12-tiles"` / `"lane-values"` は不変。)

- [ ] **Step 5: テスト全体と typecheck を通す**

Run: `npm test && npm run typecheck`
Expected: 全 PASS / typecheck exit 0。`tests/app/home-safety-gates*.test.tsx` (本体 articleId の floor 計算) は Daily Intel + 12指標の 2 本が本体のままなので無改修で通る想定。落ちたら assert の根拠コメント (`:407` 付近「lead 1 + mkt12 article 1 + signal …」) を読み、**本体数が変わっていない**ことを確認したうえで selector (`[data-column-module="lead-article"]` 等) だけを `morning-desk` に直す

- [ ] **Step 6: Commit**

```bash
git add components/home/columns/CoincidentColumn.tsx tests/components/home/gradient-columns.test.tsx tests/app/home-gradient-composition.test.tsx
git commit -m "feat(home): 中央カラムに「Daily Intel」帯 (compact Daily Intel + サムネなし 12指標行) を描き Signal を直下へ (2026-08-23 田平氏 GO B-1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 実測 (受入基準) + spec as-built + Draft PR

**Files:**
- Modify: `docs/superpowers/specs/2026-08-23-home-morning-desk-design.md` (Status 行 + §2 に実測値)
- Create: `.claude/launch.json` (無ければ) — dev server 起動定義

**Interfaces:**
- Consumes: Task 1–6 の全変更

- [ ] **Step 1: dev server を起動する**

`.claude/launch.json` が無ければ作る:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "livemakers-dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

Browser pane: `preview_start {name: "livemakers-dev"}` → `resize_window {width: 1280, height: 900}` → `navigate http://localhost:3000/ja`。**Bash で dev server を起動しない。**

- [ ] **Step 2: 受入基準を測る**

`javascript_tool` で:

```js
(() => {
  const col = document.querySelector('[data-ledger-group="coincident"]');
  const desk = document.querySelector('[data-column-module="morning-desk"]');
  const sig = document.querySelector('[data-column-module="signal-timeline"]');
  const rows = [...sig.querySelectorAll('a[data-article-id]')];
  const top = col.getBoundingClientRect().top;
  return {
    deskHeight: Math.round(desk.getBoundingClientRect().height),
    signalOffsetFromColumnTop: Math.round(sig.getBoundingClientRect().top - top),
    rowsInViewport: rows.filter(r => r.getBoundingClientRect().bottom <= window.innerHeight).length,
    header: sig.querySelector('h3').parentElement.textContent.trim(),
  };
})()
```

Expected: `signalOffsetFromColumnTop <= 420` / `rowsInViewport >= 5` / `header` に `今日 N 本`・`最新 MM-DD HH:MM` (fixture 日の場合は feed 有無で変わる — 本番 catalog を読む dev では当日値)。`read_console_messages onlyErrors` でエラー 0。`computer screenshot` を 1 枚保存 (scratchpad へ)。`/en` でも同じ計測を 1 回

- [ ] **Step 3: spec に実測を書き戻す**

spec の `Status:` を `IMPLEMENTED — AWAITING_MERGE_GO (Draft PR #NN)` に、§2 末尾に `実測 (2026-08-23 dev 1280×900): desk ≈ ___px / Signal 見出し = カラム上端 + ___px / viewport 内 Signal 行 = ___ 本` を追記。

```bash
git add docs/superpowers/specs/2026-08-23-home-morning-desk-design.md
git commit -m "docs(home): morning-desk 設計に dev 実測値を追記 (受入基準の確認)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Draft PR を作る (merge はしない — 田平氏 GO 停止線)**

```bash
git -C /Users/sition/Documents/SITION/DEV/livemakers-site/.worktrees/claude-home-morning-desk rev-parse --abbrev-ref HEAD   # claude/home-morning-desk-b1 であること
git -C /Users/sition/Documents/SITION/DEV/livemakers-site/.worktrees/claude-home-morning-desk push -u origin claude/home-morning-desk-b1
gh --repo sition-jp/livemakers-site pr create --draft --base main --head claude/home-morning-desk-b1 \
  --title "feat(home): 中央カラムに「Daily Intel」帯 + Signal 前面化 (2026-08-23 田平氏 GO B-1)" \
  --body-file <(cat <<'EOF'
## 背景
Daily Intel / 今朝の12指標 の大判カード 2 枚 (≈760px) が中央カラム上部を占め、平日 5〜7 本/日 更新の Signal がフォールド下に落ちていた。

## 変更 (spec: docs/superpowers/specs/2026-08-23-home-morning-desk-design.md)
- 勾配台帳 `coincident`: `lead-article` + `mkt12-reading` → `morning-desk` (「Daily Intel」帯) → `signal-timeline` 直下
- 帯 = ヘッダ「Daily Intel」+ 一覧リンク / compact Daily Intel (抜粋・family ラベルなし・`<xl` hidden = D8) / サムネなし `ArticleRow` の 12指標行 + 行右隣にアーカイブリンク
- Signal ヘッダに鮮度「今日 N 本 · 最新 MM-DD HH:MM」(`selectHomeSlots.signalTimelineSummary` → `HomeCopyContext`・0 本は非表示)・一覧リンクをヘッダ右端へ
- gate 6 / `selectSignalTimeline` / 週末版分岐 / awaiting 分岐は不変

## 実測 (dev 1280×900)
- desk ≈ ___px / Signal 見出し = カラム上端 + ___px (目標 ≤ 420) / viewport 内 Signal 行 = ___ 本 (目標 ≥ 5)

## テスト
`npm test` / `npm run typecheck` 全通し

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

PR URL を田平氏に提示し、merge GO を待つ。

---

## Self-Review

- **Spec coverage**: §3-1 台帳 → Task 1 / §3-2 帯 (ヘッダ・compact・12指標行・アーカイブ導線・D8) → Task 4 + 6 / §3-3 鮮度 (summary → context → copy → ヘッダ・一覧リンク右端) → Task 2 + 3 + 5 / §3-4 copy key → Task 3 / §4 不変条件 → 各 Task の Global Constraints / §5 テスト → 各 Task の Step 1 + Task 6 Step 5 / §2 受入実測 → Task 7
- **Placeholder scan**: Task 7 の `___` は実測値の記入欄 (実行時に埋める数値) であり実装の placeholder ではない
- **Type consistency**: `signalTimelineSummary.latestAt: string | null` (Task 2) → `HomeCopyContext.signalLatestAt: string | null` (Task 3) → `copy.gradient.signalFreshness.latestAt: string | null` (Task 3) → `SignalTimelineCopy.freshness` (Task 5) → `CoincidentColumn` が `freshness: copy.gradient.signalFreshness` を渡す (Task 5)。`LeadArticleCard.variant` (Task 4) を Task 6 が `variant="compact"` で使用。`data-lead-variant` (Task 4) を Task 6 のテストが参照
