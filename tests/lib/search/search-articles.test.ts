import { describe, expect, it } from "vitest";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { countByFamily, searchArticles } from "@/lib/search/search-articles";

function article(id: string, over: Partial<ArticleMeta>): ArticleMeta {
  return {
    articleId: id,
    family: "signal",
    titleJa: id,
    publishedAtJst: "2026-10-01T09:00:00+09:00",
    publishedLabel: "10-01 09:00 公開",
    lanes: [],
    href: `/articles/${id}`,
    ...over,
  } as ArticleMeta;
}

const TODAY = "2026-10-02";

describe("searchArticles", () => {
  const articles = [
    article("old-title", {
      titleJa: "Midnight の新ノード",
      publishedAtJst: "2026-09-01T09:00:00+09:00",
    }),
    article("new-excerpt", {
      titleJa: "週次まとめ",
      excerptJa: "Midnight と ETF の動き",
      publishedAtJst: "2026-10-02T08:00:00+09:00",
    }),
    article("new-title", {
      titleJa: "ＭＩＤＮＩＧＨＴ 解説",
      publishedAtJst: "2026-10-01T08:00:00+09:00",
    }),
    article("future", {
      titleJa: "Midnight 予約",
      publishedAtJst: "2026-10-03T08:00:00+09:00",
    }),
    article("flash", {
      titleJa: "速報: Midnight",
      family: "flash",
      publishedAtJst: "2026-09-30T08:00:00+09:00",
    }),
    article("body-only", {
      titleJa: "市場の一日",
      publishedAtJst: "2026-10-02T09:00:00+09:00",
    }),
  ];
  const bodyTexts = new Map([
    ["body-only", "本文で midnight の話をする"],
    ["future", "midnight"],
  ]);

  it("orders title → meta → body groups, each newest first, excludes the future, keeps flash", () => {
    const hits = searchArticles(articles, ["midnight"], TODAY, bodyTexts);
    expect(hits.map((hit) => [hit.article.articleId, hit.tier])).toEqual([
      ["new-title", "title"],
      ["flash", "title"],
      ["old-title", "title"],
      ["new-excerpt", "meta"],
      ["body-only", "body"],
    ]);
  });

  it("without body texts behaves like phase 1 (no body group)", () => {
    expect(
      searchArticles(articles, ["midnight"], TODAY).map((hit) => hit.tier),
    ).toEqual(["title", "title", "title", "meta"]);
  });

  it("requires every term (AND) across title + excerpt + family label (+ body)", () => {
    expect(
      searchArticles(articles, ["midnight", "etf"], TODAY).map(
        (hit) => hit.article.articleId,
      ),
    ).toEqual(["new-excerpt"]);
    // 種別名「Signal」でも当たる (タイトルに無いので meta 群)
    expect(
      searchArticles(articles, ["signal", "ノード"], TODAY).map((hit) => [
        hit.article.articleId,
        hit.tier,
      ]),
    ).toEqual([["old-title", "meta"]]);
    // タイトルの語 + 本文の語 = body 群
    expect(
      searchArticles(articles, ["市場", "話"], TODAY, bodyTexts).map((hit) => [
        hit.article.articleId,
        hit.tier,
      ]),
    ).toEqual([["body-only", "body"]]);
  });

  it("title tier needs all terms in the title", () => {
    const hits = searchArticles(articles, ["midnight", "ノード"], TODAY);
    expect(hits).toEqual([{ article: articles[0], tier: "title" }]);
  });

  it("returns nothing for no terms", () => {
    expect(searchArticles(articles, [], TODAY, bodyTexts)).toEqual([]);
  });
});

describe("countByFamily", () => {
  it("counts hits per family", () => {
    const hits = searchArticles(
      [
        article("a", { titleJa: "x" }),
        article("b", { titleJa: "x" }),
        article("c", { titleJa: "x", family: "deep-dive" }),
      ],
      ["x"],
      TODAY,
    );
    expect(countByFamily(hits)).toEqual({ signal: 2, "deep-dive": 1 });
  });
});
