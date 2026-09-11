import { describe, expect, it } from "vitest";

import type { ArticleInflowPublicArticle } from "@/lib/articles/article-inflow-contract";
import {
  buildRssFeedXml,
  resolveArticleDescription,
  RSS_FEED_ITEM_COUNT,
  toRfc822Jst,
} from "@/lib/articles/rss-feed";

function article(
  overrides: Partial<ArticleInflowPublicArticle> = {},
): ArticleInflowPublicArticle {
  return {
    articleId: "daily-intel-20260911-abc123",
    family: "daily-intel",
    titleJa: "Daily Intel 9/11",
    publishedAtJst: "2026-09-11T05:50:00+09:00",
    publishedLabel: "09-11 05:50 公開",
    lanes: [],
    href: "/articles/daily-intel-20260911-abc123",
    source: "inflow",
    ...overrides,
  } as ArticleInflowPublicArticle;
}

describe("lib/articles/rss-feed", () => {
  describe("toRfc822Jst", () => {
    it("renders the JST wall-clock time regardless of server timezone", () => {
      expect(toRfc822Jst("2026-09-11T05:50:00+09:00")).toBe(
        "Fri, 11 Sep 2026 05:50:00 +0900",
      );
    });
  });

  describe("resolveArticleDescription", () => {
    it("prefers excerptJa", () => {
      const desc = resolveArticleDescription(
        article({ excerptJa: "これは要約です。" }),
      );
      expect(desc).toBe("これは要約です。");
    });

    it("falls back to inflowBody, stripped and truncated to 200 chars", () => {
      const long = "あ".repeat(250);
      const desc = resolveArticleDescription(article({ inflowBody: long }));
      expect(Array.from(desc).length).toBe(200);
      expect(desc.endsWith("…")).toBe(true);
    });

    it("falls back to the title when nothing else is available", () => {
      const desc = resolveArticleDescription(article({ titleJa: "タイトルのみ" }));
      expect(desc).toBe("タイトルのみ");
    });
  });

  describe("buildRssFeedXml", () => {
    const xml = buildRssFeedXml(
      [article({ thumbnailUrl: "https://example.com/thumb.webp" })],
      "https://livemakers.com/ja/feed.xml",
    );

    it("declares RSS 2.0 with the atom self link", () => {
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain(
        '<atom:link href="https://livemakers.com/ja/feed.xml" rel="self" type="application/rss+xml" />',
      );
    });

    it("emits guid isPermaLink=true pointing at the canonical /ja url", () => {
      expect(xml).toContain(
        '<guid isPermaLink="true">https://livemakers.com/ja/articles/daily-intel-20260911-abc123</guid>',
      );
    });

    it("emits an enclosure only when a thumbnail exists", () => {
      expect(xml).toContain(
        '<enclosure url="https://example.com/thumb.webp" type="image/webp" />',
      );
      const withoutThumb = buildRssFeedXml(
        [article({ thumbnailUrl: undefined })],
        "https://livemakers.com/ja/feed.xml",
      );
      expect(withoutThumb).not.toContain("<enclosure");
    });

    it("emits the family label as <category>", () => {
      expect(xml).toContain("<category>Daily Intel</category>");
    });

    it("caps items at 50", () => {
      const many = Array.from({ length: RSS_FEED_ITEM_COUNT + 10 }, (_, i) =>
        article({ articleId: `daily-intel-2026091${i}` }),
      );
      const bigXml = buildRssFeedXml(many, "https://livemakers.com/ja/feed.xml");
      expect(bigXml.match(/<item>/g)?.length).toBe(RSS_FEED_ITEM_COUNT);
    });
  });
});
