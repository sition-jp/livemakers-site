import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ARTICLE_INFLOW_CATALOG_REVALIDATE_SECONDS } from "@/lib/articles/article-inflow-feed";
import {
  ARTICLE_OPTIONAL_CACHE_TAG,
  OPTIONAL_REVALIDATE_SECONDS,
} from "@/lib/articles/article-inflow-v2";
import { decideCronRefresh } from "@/lib/revalidate";
import {
  TERMINAL_FEED_CACHE_TAG,
  TERMINAL_FEED_ENV_KEY,
  TERMINAL_FEED_REVALIDATE_SECONDS,
  fetchLiveMarketData,
} from "@/lib/terminal/live-market-feed";

// 2026-10-26 段 1 (設計書 08_DOCS/knowledge/specs/2026-10-26-lvm-lmk-vercel-cost-on-demand-and-catalog-split-design.md):
// 時間での作り直しは保険に下げ、記事の公開・セッション時刻・0 時の合図で作り直す。
// 時間の短縮へ戻すと ISR 書き込みと CPU が読者数と無関係に増える (コストの穴)。
const SIX_HOURS = [
  "app/[locale]/page.tsx",
  "app/[locale]/about/page.tsx",
  "app/[locale]/articles/series/[series]/page.tsx",
  "app/[locale]/articles/series/[series]/page/[page]/page.tsx",
  "app/[locale]/articles/today/page.tsx",
  "app/[locale]/future-atlas/page.tsx",
  "app/[locale]/future-atlas/ledger/page.tsx",
  "app/[locale]/future-atlas/methodology/page.tsx",
  "app/[locale]/sessions/archive/page.tsx",
  "app/[locale]/sessions/archive/past/page.tsx",
  "app/[locale]/topics/[topic]/page.tsx",
  "app/[locale]/topics/[topic]/page/[page]/page.tsx",
  "app/[locale]/videos/page.tsx",
  "app/sitemap-news.xml/route.ts",
];
const ONE_DAY = [
  "app/[locale]/articles/[slug]/page.tsx",
  "app/ja/feed.xml/route.ts",
  "app/ja/feed/route.ts",
  "app/sitemap.ts",
];

// 短い間隔のまま残すページ (理由つき)。増やすときはここに理由を書く
const SHORT_TIMER_EXCEPTIONS = [
  // その日の記事がまだ無いときの 404 を長く残さない (2026-11-10)。日付ごとに 1 ページで数が少ない
  "app/[locale]/articles/day/[date]/page.tsx",
  // ビルドで作る 14 本だけ (dynamicParams = false)
  "app/[locale]/videos/[slug]/page.tsx",
];

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

afterEach(() => {
  delete process.env[TERMINAL_FEED_ENV_KEY];
  vi.unstubAllGlobals();
});

describe("ISR intervals (段 1・2026-11-12 入れ直し)", () => {
  it.each(SIX_HOURS)("re-renders %s by time only every 6 hours", (file) => {
    expect(fs.readFileSync(file, "utf8")).toContain("export const revalidate = 21600;");
  });

  it.each(ONE_DAY)("re-renders %s by time only once a day", (file) => {
    expect(fs.readFileSync(file, "utf8")).toContain("export const revalidate = 86400;");
  });

  it("keeps no page on the old 5-minute / 1-hour timers", () => {
    const offenders = listSources("app")
      .filter((file) => !SHORT_TIMER_EXCEPTIONS.includes(file))
      .filter((file) =>
        /export const revalidate = (300|3600);/.test(fs.readFileSync(file, "utf8")),
      );
    expect(offenders).toEqual([]);
  });

  it("schedules the 00:00 JST refresh next to the session-anchor crons", () => {
    const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const schedules = vercel.crons
      .filter((cron) => cron.path === "/api/cron/refresh-home")
      .map((cron) => cron.schedule);
    expect(schedules).toEqual([
      "12 20 * * *",
      "50 22 * * *",
      "12 3 * * *",
      "12 9 * * *",
      "12 14 * * *",
      "0 15 * * *",
    ]);
  });

  it("tags the market-feed fetch so the cron can refresh every page's ticker", async () => {
    process.env[TERMINAL_FEED_ENV_KEY] = "https://example.test/terminal_feed.public.json";
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: false, status: 503 }) as Response,
    );
    vi.stubGlobal("fetch", fetcher);
    await fetchLiveMarketData();
    const init = fetcher.mock.calls[0]?.[1] as RequestInit & {
      next?: { tags?: string[] };
    };
    expect(init.next?.tags).toEqual([TERMINAL_FEED_CACHE_TAG]);
  });

  // ページの作り直し間隔は、そのページが読む取得の保存期間の最小値になる
  // (2026-11-12 手元ビルドで実測: 取得が 3600 のままだと全ページが 1h だった)。
  // 取得側を短くすると、ページに書いた 6 時間・1 日が黙って効かなくなる
  it("keeps fetch lifetimes from undercutting the page intervals", () => {
    // 共通の枠 (全ページ) と記事詳細の補助ファイル: 記事詳細の 1 日以上
    expect(TERMINAL_FEED_REVALIDATE_SECONDS).toBeGreaterThanOrEqual(86400);
    expect(OPTIONAL_REVALIDATE_SECONDS).toBeGreaterThanOrEqual(86400);
    // 記事カタログ (一覧系): 一覧系の 6 時間以上
    expect(ARTICLE_INFLOW_CATALOG_REVALIDATE_SECONDS).toBeGreaterThanOrEqual(21600);
  });

  it("refreshes the long-lived fetches from the cron", () => {
    const decision = decideCronRefresh("secret", "Bearer secret");
    expect(decision).toMatchObject({
      ok: true,
      tags: [TERMINAL_FEED_CACHE_TAG, ARTICLE_OPTIONAL_CACHE_TAG],
    });
  });
});
