import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  resetArticleInflowFeedMemo,
} from "@/lib/articles/article-inflow-feed";
import { loadHomeCompositionProps } from "@/lib/home/load-home-composition";
import { TERMINAL_FEED_ENV_KEY } from "@/lib/terminal/live-market-feed";

const originalProductionUrl =
  process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
const originalPublicFlag = process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
const originalTerminalUrl = process.env[TERMINAL_FEED_ENV_KEY];

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
