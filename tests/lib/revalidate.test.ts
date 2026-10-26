import { describe, expect, it } from "vitest";

import {
  ARTICLE_FEED_PATHS,
  ARTICLE_LISTING_ROUTES,
  decideCronRefresh,
  decideRevalidate,
} from "@/lib/revalidate";
import { TERMINAL_FEED_CACHE_TAG } from "@/lib/terminal/live-market-feed";

const TOKEN = "test-revalidate-token";
const AUTH = `Bearer ${TOKEN}`;

describe("on-demand revalidation decision (GO#2 追補・GO#3 まで inert)", () => {
  it("is fully inert (404) while the token env is not provisioned", () => {
    const decision = decideRevalidate(undefined, AUTH, {
      paths: ["/ja/articles/x"],
    });
    expect(decision).toEqual({
      ok: false,
      status: 404,
      reason: "route_disabled",
    });
  });

  it("rejects a missing or wrong bearer token with 401", () => {
    expect(decideRevalidate(TOKEN, null, { paths: ["/ja"] })).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(
      decideRevalidate(TOKEN, "Bearer wrong", { paths: ["/ja"] }),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts only article-surface paths and dedupes", () => {
    const decision = decideRevalidate(TOKEN, AUTH, {
      paths: [
        "/ja",
        "/ja/articles",
        "/ja/articles/signal-20260807-abc12345",
        "/en/articles/series/signal",
        "/ja/articles/signal-20260807-abc12345",
      ],
    });
    // 2026-10-26 段 1: 記事の path を含む合図 = 記事カタログが変わった合図。
    // 一覧系のページの「種類」と RSS・sitemap もまとめて作り直す
    expect(decision).toEqual({
      ok: true,
      paths: [
        "/ja",
        "/ja/articles",
        "/ja/articles/signal-20260807-abc12345",
        "/en/articles/series/signal",
        ...ARTICLE_FEED_PATHS,
      ],
      routes: [...ARTICLE_LISTING_ROUTES],
    });
  });

  it("lists the listing route types and feeds that read the article catalog", () => {
    expect(ARTICLE_LISTING_ROUTES).toEqual([
      "/[locale]",
      "/[locale]/articles/today",
      "/[locale]/articles/series/[series]",
      "/[locale]/articles/series/[series]/page/[page]",
      // 「最新記事」の欄 (loadLatestArticlesRail) を持つページ
      "/[locale]/about",
      "/[locale]/sessions/archive",
      "/[locale]/sessions/archive/past",
      "/[locale]/future-atlas",
    ]);
    // 記事詳細の「種類」は含めない — 公開レーンが記事ごとの path を送る
    expect(ARTICLE_LISTING_ROUTES).not.toContain("/[locale]/articles/[slug]");
    expect(ARTICLE_FEED_PATHS).toEqual([
      "/sitemap.xml",
      "/sitemap-news.xml",
      "/ja/feed.xml",
      "/ja/feed",
    ]);
  });

  it("does not expand to listing routes for the market-feed push (home + sessions only)", () => {
    const decision = decideRevalidate(TOKEN, AUTH, {
      paths: ["/ja", "/en", "/ja/sessions/2026-10-26-europe-bridge"],
    });
    expect(decision).toEqual({
      ok: true,
      paths: ["/ja", "/en", "/ja/sessions/2026-10-26-europe-bridge"],
    });
  });

  it("accepts session surfaces (archive + detail) — Phase 1, 2026-08-14", () => {
    const decision = decideRevalidate(TOKEN, AUTH, {
      paths: [
        "/ja/sessions",
        "/ja/sessions/archive",
        "/ja/sessions/2026-08-07-asia-open",
        "/en/sessions/archive",
      ],
    });
    expect(decision).toEqual({
      ok: true,
      paths: [
        "/ja/sessions",
        "/ja/sessions/archive",
        "/ja/sessions/2026-08-07-asia-open",
        "/en/sessions/archive",
      ],
    });
  });

  it.each([
    ["empty paths", { paths: [] }],
    ["not an array", { paths: "/ja" }],
    ["no payload", null],
    ["path traversal", { paths: ["/ja/../api"] }],
    ["non-article route", { paths: ["/api/revalidate"] }],
    ["absolute url", { paths: ["https://livemakers.com/ja"] }],
    ["sessions traversal", { paths: ["/ja/sessions/../../api"] }],
    ["sessions uppercase", { paths: ["/ja/sessions/2026-08-07-ASIA"] }],
  ])("rejects %s with 400", (_label, payload) => {
    expect(decideRevalidate(TOKEN, AUTH, payload)).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});

describe("cron refresh backstop decision (Phase 1, 2026-08-14)", () => {
  it("is fully inert (404) while CRON_SECRET is not provisioned", () => {
    expect(decideCronRefresh(undefined, AUTH)).toEqual({
      ok: false,
      status: 404,
      reason: "route_disabled",
    });
  });

  it("rejects a missing or wrong bearer with 401", () => {
    expect(decideCronRefresh(TOKEN, null)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(decideCronRefresh(TOKEN, "Bearer wrong")).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  // 2026-10-26 段 1: 時間での作り直しを 6 時間に延ばすので、セッション時刻と
  // 0 時の cron が home + セッション一覧を作り直し、市場データのタグで全ページの
  // ティッカー (共通の枠) を次のアクセス時に新しくする
  it("purges home + session archives and the market-feed tag on a valid call", () => {
    expect(decideCronRefresh(TOKEN, AUTH)).toEqual({
      ok: true,
      paths: ["/ja", "/en", "/ja/sessions/archive", "/en/sessions/archive"],
      tags: [TERMINAL_FEED_CACHE_TAG],
    });
  });
});

// 2026-10-26 段 1: 「最新記事」の欄を持つページは、記事の公開で作り直す一覧に
// 必ず入れる (欄が 6 時間古いままになるのを防ぐ)。欄を使うページが増えたら
// ARTICLE_LISTING_ROUTES にも足す
describe("pages with the latest-articles rail are refreshed on publish", () => {
  it("covers every static page that renders loadLatestArticlesRail", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : entry.name === "page.tsx" ? [full] : [];
      });
    const railPages = walk("app")
      .filter((file) => fs.readFileSync(file, "utf8").includes("loadLatestArticlesRail"))
      // search はリクエストごとに描画する (ISR ではない)
      .filter((file) => !file.includes(`${path.sep}search${path.sep}`))
      .map((file) => file.replace(/^app/, "").replace(/\/page\.tsx$/, ""));
    expect(railPages.length).toBeGreaterThan(0);
    for (const route of railPages) {
      expect(ARTICLE_LISTING_ROUTES, route).toContain(route);
    }
  });
});
