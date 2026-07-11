import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARTICLE_FAMILIES,
  ArticleMetaSchema,
  SERIES_SLUGS,
  getAllArticles,
  getArticleBySlug,
} from "@/lib/articles/article-model";

const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);
const testOptions = { contentDir: TEST_CONTENT_DIR };

describe("article model + lane taxonomy", () => {
  it("loads from an injected contentDir without falling back to runtime content", () => {
    const missing = path.join(process.cwd(), "tests", "fixtures", "missing-content");
    expect(getAllArticles({ contentDir: missing })).toEqual([]);
  });

  it("declares the eight G40 families plus session", () => {
    expect(ARTICLE_FAMILIES).toEqual([
      "daily-intel",
      "signal",
      "deep-dive",
      "future-map",
      "mkt12-morning",
      "mkt12-weekend",
      "event-risk-radar",
      "weekly-brief",
      "session",
    ]);
    expect(SERIES_SLUGS).toEqual([
      "daily-intel",
      "signal",
      "deep-dive",
      "future-map",
      "mkt12-morning",
      "mkt12-weekend",
      "event-risk-radar",
      "weekly-brief",
    ]);
  });

  it("loads fixtures with valid frontmatter and locale-less hrefs", () => {
    const articles = getAllArticles(testOptions);
    expect(articles.length).toBeGreaterThanOrEqual(18);
    for (const article of articles) {
      expect(article.href).toBe(`/articles/${article.articleId}`);
      expect(article.href.startsWith("/ja/")).toBe(false);
    }
    const lead = getArticleBySlug("daily-intel-2026-07-10", testOptions);
    expect(lead.family).toBe("daily-intel");
    expect(lead.titleJa).toContain("CPI通過後の市場地図");
  });

  it("keeps lane taxonomy bounded and pairs signal to radar topic", () => {
    const signal = getArticleBySlug(
      "signal-stablecoin-supply-2026-07-10",
      testOptions,
    );
    expect(signal.lanes).toEqual(["crypto"]);
    expect(signal.radarTopicId).toBe("stablecoin_supply_20260710");
    expect(getArticleBySlug("event-risk-radar-w29", testOptions).lanes).toEqual([
      "macro",
    ]);
  });

  it("keeps regime note editorial-only on mkt12 morning articles", () => {
    expect(
      getArticleBySlug("mkt12-morning-2026-07-10", testOptions).regimeNoteJa,
    ).toBe("リスクオン — BTC・ETH上昇・VIX低位安定");
    expect(
      getArticleBySlug("signal-dxy-plateau-2026-07-09", testOptions).regimeNoteJa,
    ).toBeUndefined();
  });

  it("rejects reserved slugs and malformed sourceXUrl", () => {
    expect(() =>
      ArticleMetaSchema.parse({
        articleId: "today",
        family: "signal",
        titleJa: "x",
        publishedAtJst: "2026-07-10T06:10:00+09:00",
        publishedLabel: "07-10 06:10 公開",
      }),
    ).toThrow(/reserved route segment/);
    expect(() =>
      ArticleMetaSchema.parse({
        articleId: "signal-x",
        family: "signal",
        titleJa: "x",
        publishedAtJst: "2026-07-10T06:10:00+09:00",
        publishedLabel: "07-10 06:10 公開",
        sourceXUrl: "https://example.com/not-x",
      }),
    ).toThrow();
    expect(() =>
      ArticleMetaSchema.parse({
        articleId: "mkt12-morning-x",
        family: "mkt12-morning",
        titleJa: "x",
        publishedAtJst: "2026-07-10T05:20:00+09:00",
        publishedLabel: "07-10 05:20 公開",
      }),
    ).toThrow(/require dataDate/);
  });
});
