import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const topicIndexMock = vi.hoisted(() => ({ fetchArticleTopicIndex: vi.fn() }));
vi.mock("@/lib/articles/article-inflow-v2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/articles/article-inflow-v2")>()),
  fetchArticleTopicIndex: topicIndexMock.fetchArticleTopicIndex,
}));

import {
  ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  resetArticleInflowFeedMemo,
} from "@/lib/articles/article-inflow-feed";
import {
  loadChromeProps,
  loadHomeCompositionProps,
} from "@/lib/home/load-home-composition";
import {
  TERMINAL_FEED_ENV_KEY,
  TerminalFeedUnavailableError,
} from "@/lib/terminal/live-market-feed";

const originalProductionUrl =
  process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
const originalPublicFlag = process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
const originalTerminalUrl = process.env[TERMINAL_FEED_ENV_KEY];
const originalNextPhase = process.env.NEXT_PHASE;

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function productionFeed(articles: unknown[]) {
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "production",
    generated_at: "2026-08-03T09:00:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles,
  };
}

function feedArticle() {
  const body = "# Feed overlay\n";
  return {
    slug: "signal-20260803-feedtest",
    title: "Feed overlay article",
    family: "signal",
    source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
    published_at: "2026-08-03T00:00:00Z",
    body,
    body_checksum: createHash("sha256").update(body, "utf8").digest("hex"),
    validator: {
      verdict: "green",
      vocabulary_version: "99f41b7549a0a4f5",
    },
  };
}

beforeEach(() => {
  topicIndexMock.fetchArticleTopicIndex.mockReset();
  topicIndexMock.fetchArticleTopicIndex.mockResolvedValue(null);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-03T10:00:00+09:00"));
  delete process.env[TERMINAL_FEED_ENV_KEY];
});

afterEach(() => {
  restoreEnv(
    ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
    originalProductionUrl,
  );
  restoreEnv(ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY, originalPublicFlag);
  restoreEnv(TERMINAL_FEED_ENV_KEY, originalTerminalUrl);
  restoreEnv("NEXT_PHASE", originalNextPhase);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // 2026-08-23 案 B: feed はプロセス内メモ (TTL 2 分) されるので、同じ URL を
  // 使うテスト間で持ち越さない
  resetArticleInflowFeedMemo();
});

describe("loadHomeCompositionProps article catalog states", () => {
  it("marks feed ON and injects an overlay article into the home slots", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] =
      "https://example.test/production.json";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => productionFeed([feedArticle()]),
      })),
    );

    const result = await loadHomeCompositionProps();

    expect(result.catalogSource).toBe("repository_plus_feed");
    expect(
      result.props.slots.latestArticles.map((article) => article.articleId),
    ).toContain("signal-20260803-feedtest");
  });

  it("marks feed OFF as repository_only", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] =
      "https://example.test/production.json";
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const result = await loadHomeCompositionProps();

    expect(result.catalogSource).toBe("repository_only");
    expect(result.props.slots.latestArticles.length).toBeGreaterThan(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("marks a valid-empty feed as repository_plus_feed", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] =
      "https://example.test/production.json";
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => productionFeed([]),
    }));
    vi.stubGlobal("fetch", fetcher);

    const result = await loadHomeCompositionProps();

    expect(result.catalogSource).toBe("repository_plus_feed");
    expect(result.props.slots.latestArticles.length).toBeGreaterThan(0);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

// 資金調達の棚 (入口 ②): 取れなくてもトップは作れる (棚が出ないだけ)
describe("loadHomeCompositionProps funding shelf", () => {
  const fundingArticle = (id: string, at: string) => ({
    articleId: id,
    family: "signal" as const,
    titleJa: id,
    publishedAtJst: at,
    publishedLabel: at.slice(5, 16),
    lanes: [],
    href: `/articles/${id}`,
  });

  it("topic index failure does not fail home", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    topicIndexMock.fetchArticleTopicIndex.mockResolvedValue(null);
    const nullResult = await loadHomeCompositionProps();
    expect(nullResult.props.slots.fundingArticles).toEqual([]);
  });

  it("a throwing topic fetch does not fail home either", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    topicIndexMock.fetchArticleTopicIndex.mockRejectedValue(new Error("boom"));
    const result = await loadHomeCompositionProps();
    expect(result.props.slots.fundingArticles).toEqual([]);
  });

  it("passes topic articles through to the slots", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    topicIndexMock.fetchArticleTopicIndex.mockResolvedValue({
      topic: "funding",
      generatedAt: "2026-08-03T09:00:00+09:00",
      articles: [fundingArticle("fd-1", "2026-08-02T09:00:00+09:00")],
    });
    const result = await loadHomeCompositionProps();
    expect(result.props.slots.fundingArticles.map((a) => a.articleId)).toEqual(["fd-1"]);
    expect(topicIndexMock.fetchArticleTopicIndex).toHaveBeenCalledWith("funding");
  });

  // 公開の切り替えを切ったら棚は出さない (本物の fetchArticleTopicIndex で確かめる)
  it("public flag off → no funding articles and no topic fetch", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/articles/article-inflow-v2")
    >("@/lib/articles/article-inflow-v2");
    topicIndexMock.fetchArticleTopicIndex.mockImplementation(
      (topic: "funding") => actual.fetchArticleTopicIndex(topic),
    );
    const originalBase = process.env[actual.ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY];
    process.env[actual.ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY] =
      "http://127.0.0.1:8787/livemakers/article_inflow/v2";
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL) => {
      throw new Error("must not fetch");
    });
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const result = await loadHomeCompositionProps();
      expect(result.props.slots.fundingArticles).toEqual([]);
      expect(
        fetchSpy.mock.calls.some(([url]) => String(url).includes("/topics/")),
      ).toBe(false);
    } finally {
      restoreEnv(actual.ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY, originalBase);
    }
  });
});

// 2026-10-26: 全ページ共通の枠 (ティッカー・来歴帯・スナップショット表示) は
// 市場データだけを使う。記事カタログ (1.6MB・データキャッシュに載らない) を読むと、
// 全ページの作り直しのたびに取得が走っていた
describe("loadChromeProps (site chrome without the article catalog)", () => {
  it("never fetches the article catalog, yet yields the same chrome values", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] =
      "https://example.test/production.json";
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => productionFeed([feedArticle()]),
    }));
    vi.stubGlobal("fetch", fetcher);

    const chrome = await loadChromeProps();

    expect(fetcher).not.toHaveBeenCalled();
    const home = await loadHomeCompositionProps();
    expect(chrome.tickerItems).toEqual(home.props.tickerItems);
    expect(chrome.pageProvenance).toEqual(home.props.pageProvenance);
    expect(chrome.snapshot).toEqual(home.props.snapshot);
  });
});

// 2026-10-26 (PR-A): 21:46 の /ja は記事カタログと市場データの両方が 403 で
// 取れず、見本の市場データ (7/10) で描かれてキャッシュされた。市場データも
// 実行時に取れなければエラーにして、前の正常なページを出し続けさせる
describe("market feed unavailable at runtime keeps the previous page", () => {
  function failingMarketFeed() {
    process.env[TERMINAL_FEED_ENV_KEY] = "https://example.test/terminal_feed.public.json";
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 }) as unknown as Response),
    );
  }

  it("throws from both the chrome and the home loaders", async () => {
    delete process.env.NEXT_PHASE;
    failingMarketFeed();
    await expect(loadChromeProps()).rejects.toBeInstanceOf(TerminalFeedUnavailableError);
    await expect(loadHomeCompositionProps()).rejects.toBeInstanceOf(
      TerminalFeedUnavailableError,
    );
  });

  it("still falls back to the fixture snapshot during next build", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    failingMarketFeed();
    const chrome = await loadChromeProps();
    expect(chrome.tickerItems.length).toBeGreaterThan(0);
  });

  it("uses the fixture without throwing when no market feed is configured", async () => {
    delete process.env.NEXT_PHASE;
    delete process.env[TERMINAL_FEED_ENV_KEY];
    const chrome = await loadChromeProps();
    expect(chrome.tickerItems.length).toBeGreaterThan(0);
  });
});
