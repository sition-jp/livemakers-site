import { describe, expect, it } from "vitest";

import ja from "@/messages/ja.json";
import type { ArticleInflowPublicArticle } from "@/lib/articles/article-inflow-contract";
import { ARTICLE_FAMILIES, type ArticleFamily } from "@/lib/articles/article-model";
import { FAMILY_MARK } from "@/lib/articles/family-mark";
import { buildRssFeedXml } from "@/lib/articles/rss-feed";
import { buildLlmsTxt } from "@/lib/llms-txt";
import { buildArticleJsonLd } from "@/lib/seo/article-json-ld";

/**
 * 題から種類のラベル (📡 Signal｜ など) が消えても、AI と RSS リーダーには
 * 種類が伝わり続けることを固定する (2026-11-16 題のラベルを外す設計 §5-4)。
 * JSON-LD の articleSection と RSS の <category> は題ではなく family から出る。
 * llms.txt はシリーズの説明を持つ。どれも印 (絵文字) は付けない。
 */
const FAMILY_NAMES = ja.articles.family as Record<ArticleFamily, string>;

// ラベルの無い新しい形の題 (spec §4)
const LABEL_FREE_TITLE = "Circle Arc の創設バリデータに BlackRock・Visa・DTCC";

describe("machine-readable article type survives label-free titles", () => {
  it.each(ARTICLE_FAMILIES)("JSON-LD articleSection comes from family: %s", (family) => {
    const json = buildArticleJsonLd({
      articleId: `${family}-20261116-aaaa1111`,
      titleJa: LABEL_FREE_TITLE,
      publishedAtJst: "2026-11-16T07:00:00+09:00",
      family,
      lang: "ja",
    });
    expect(json.headline).toBe(LABEL_FREE_TITLE);
    expect(json.articleSection).toBe(FAMILY_NAMES[family]);
  });

  it.each(ARTICLE_FAMILIES)("RSS <category> comes from family: %s", (family) => {
    const xml = buildRssFeedXml(
      [
        {
          articleId: `${family}-20261116-aaaa1111`,
          family,
          titleJa: LABEL_FREE_TITLE,
          publishedAtJst: "2026-11-16T07:00:00+09:00",
          publishedLabel: "11-16 07:00 公開",
          lanes: [],
          href: `/articles/${family}-20261116-aaaa1111`,
          source: "inflow",
        } as ArticleInflowPublicArticle,
      ],
      "https://livemakers.com/ja/feed.xml",
    );
    expect(xml).toContain(`<category>${FAMILY_NAMES[family]}</category>`);
  });

  it("keeps the marks out of the machine-readable names", () => {
    for (const family of ARTICLE_FAMILIES) {
      const mark = FAMILY_MARK[family];
      if (mark) expect(FAMILY_NAMES[family]).not.toContain(mark);
    }
  });

  it("llms.txt names the main series and links each series list", () => {
    const text = buildLlmsTxt();
    for (const family of ["daily-intel", "signal", "deep-dive", "weekly-brief"] as const) {
      expect(text).toContain(
        `[${FAMILY_NAMES[family]}](https://livemakers.com/ja/articles/series/${family})`,
      );
    }
    expect(text).toContain("https://livemakers.com/ja/articles/series/mkt12-morning");
    expect(text).toContain("https://livemakers.com/ja/articles/series/mkt12-weekend");
  });
});
