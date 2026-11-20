import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import {
  RAIL_FEED_LATEST_COUNT,
  RAIL_FEED_PER_FAMILY_COUNT,
  isArticleRailFeed,
  trimRailArticles,
} from "@/lib/articles/article-rail-feed";

const article = (
  articleId: string,
  family: ArticleMeta["family"],
  publishedAtJst: string,
): ArticleMeta => ({
  articleId,
  family,
  titleJa: `記事 ${articleId}`,
  publishedAtJst,
  publishedLabel: publishedAtJst.slice(5, 16),
  lanes: [],
  href: `/articles/${articleId}`,
});

const at = (index: number) =>
  new Date(Date.UTC(2026, 10, 1) + index * 3_600_000).toISOString().replace("Z", "+00:00");

describe("trimRailArticles", () => {
  it("keeps the newest 25 overall plus the newest 6 of every series, newest first", () => {
    const signals = Array.from({ length: 40 }, (_, index) => article(`sig-${index}`, "signal", at(100 + index)));
    const deepDives = Array.from({ length: 10 }, (_, index) => article(`dd-${index}`, "deep-dive", at(index)));
    const trimmed = trimRailArticles([...deepDives, ...signals]);

    const ids = trimmed.map((item) => item.articleId);
    // Signal は全体の新しい 25 本 (sig-39〜sig-15)、Deep Dive は古くてもシリーズの 6 本
    expect(ids.filter((id) => id.startsWith("sig-"))).toHaveLength(RAIL_FEED_LATEST_COUNT);
    expect(ids.filter((id) => id.startsWith("dd-"))).toEqual(["dd-9", "dd-8", "dd-7", "dd-6", "dd-5", "dd-4"]);
    expect(ids.filter((id) => id.startsWith("dd-"))).toHaveLength(RAIL_FEED_PER_FAMILY_COUNT);
    expect(ids[0]).toBe("sig-39");
    expect(trimmed.map((item) => item.publishedAtJst)).toEqual(
      trimmed.map((item) => item.publishedAtJst).toSorted().reverse(),
    );
  });

  it("drops duplicate articles (repository and rail can both carry one)", () => {
    const one = article("sig-1", "signal", at(1));
    expect(trimRailArticles([one, { ...one }, article("sig-2", "signal", at(2))])).toHaveLength(2);
  });
});

describe("isArticleRailFeed", () => {
  it("accepts the feed shape and rejects broken payloads", () => {
    expect(isArticleRailFeed({ articles: [article("a", "signal", at(1))], surfacePublished: true })).toBe(true);
    expect(isArticleRailFeed({ articles: [], surfacePublished: false })).toBe(true);
    expect(isArticleRailFeed(null)).toBe(false);
    expect(isArticleRailFeed({ articles: [{ articleId: "a" }], surfacePublished: false })).toBe(false);
    expect(isArticleRailFeed({ articles: [] })).toBe(false);
  });
});
