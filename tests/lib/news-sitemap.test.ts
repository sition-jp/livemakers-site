import { describe, expect, it } from "vitest";

import type { ArticleInflowPublicArticle } from "@/lib/articles/article-inflow-contract";
import {
  buildNewsSitemapXml,
  NEWS_SITEMAP_MAX_URLS,
  selectNewsSitemapArticles,
} from "@/lib/articles/news-sitemap";

const NOW = new Date("2026-09-11T12:00:00+09:00");

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

describe("lib/articles/news-sitemap", () => {
  describe("selectNewsSitemapArticles", () => {
    it("keeps articles published within the last 48h", () => {
      const fresh = article({ publishedAtJst: "2026-09-10T13:00:00+09:00" });
      const stale = article({
        articleId: "daily-intel-20260908-old",
        publishedAtJst: "2026-09-08T05:00:00+09:00",
      });
      const selected = selectNewsSitemapArticles([fresh, stale], NOW);
      expect(selected).toEqual([fresh]);
    });

    it("caps at 1000 URLs", () => {
      const many = Array.from({ length: NEWS_SITEMAP_MAX_URLS + 50 }, (_, i) =>
        article({ articleId: `daily-intel-2026091${i}` }),
      );
      expect(selectNewsSitemapArticles(many, NOW)).toHaveLength(
        NEWS_SITEMAP_MAX_URLS,
      );
    });
  });

  describe("buildNewsSitemapXml", () => {
    it("emits the news:publication block with LiveMakers / ja", () => {
      const xml = buildNewsSitemapXml([article()], NOW);
      expect(xml).toContain("<news:name>LiveMakers</news:name>");
      expect(xml).toContain("<news:language>ja</news:language>");
      expect(xml).toContain(
        "<news:publication_date>2026-09-11T05:50:00+09:00</news:publication_date>",
      );
      expect(xml).toContain("<loc>https://livemakers.com/ja/articles/daily-intel-20260911-abc123</loc>");
    });

    it("escapes titles containing XML-significant characters", () => {
      const xml = buildNewsSitemapXml(
        [article({ titleJa: 'A & B <danger> "quote"' })],
        NOW,
      );
      expect(xml).toContain("A &amp; B &lt;danger&gt; &quot;quote&quot;");
      expect(xml).not.toContain("<danger>");
    });

    it("excludes articles outside the 48h window", () => {
      const xml = buildNewsSitemapXml(
        [article({ publishedAtJst: "2026-09-01T05:00:00+09:00" })],
        NOW,
      );
      expect(xml).not.toContain("<url>");
    });
  });
});
