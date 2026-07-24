import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import { getRelatedArticles, getSeriesNeighbors } from "@/lib/articles/related";

const article = (
  articleId: string,
  family: ArticleMeta["family"],
  publishedAtJst: string,
  lanes: ArticleMeta["lanes"] = [],
): ArticleMeta => ({
  articleId,
  family,
  titleJa: `記事 ${articleId}`,
  publishedAtJst,
  publishedLabel: publishedAtJst.slice(5, 16),
  lanes,
  href: `/articles/${articleId}`,
});

const signalOld = article("sig-old", "signal", "2026-07-01T08:00:00+09:00");
const signalMid = article("sig-mid", "signal", "2026-07-05T08:00:00+09:00");
const signalNew = article("sig-new", "signal", "2026-07-09T08:00:00+09:00");
const intel = article("intel-1", "daily-intel", "2026-07-08T08:00:00+09:00", ["macro"]);
const deepMacro = article("dd-macro", "deep-dive", "2026-07-07T08:00:00+09:00", ["macro"]);
const deepCrypto = article("dd-crypto", "deep-dive", "2026-07-06T08:00:00+09:00", ["crypto"]);

const catalog = [signalNew, intel, deepMacro, deepCrypto, signalMid, signalOld];

describe("getSeriesNeighbors", () => {
  it("returns the adjacent same-family articles by publishedAtJst", () => {
    const { prev, next } = getSeriesNeighbors(catalog, signalMid);
    expect(prev?.articleId).toBe("sig-old");
    expect(next?.articleId).toBe("sig-new");
  });

  it("returns null on the series edges", () => {
    expect(getSeriesNeighbors(catalog, signalNew).next).toBeNull();
    expect(getSeriesNeighbors(catalog, signalOld).prev).toBeNull();
  });

  it("ignores other families entirely", () => {
    const { prev, next } = getSeriesNeighbors(catalog, intel);
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });
});

describe("getRelatedArticles", () => {
  it("prefers same-family articles (newest first) and excludes the current article", () => {
    const related = getRelatedArticles(catalog, signalMid);
    expect(related.map((entry) => entry.articleId).slice(0, 2)).toEqual([
      "sig-new",
      "sig-old",
    ]);
    expect(related.some((entry) => entry.articleId === "sig-mid")).toBe(false);
  });

  it("fills the remainder with lane-overlapping articles", () => {
    const current = article("dd-current", "deep-dive", "2026-07-09T09:00:00+09:00", ["macro"]);
    const related = getRelatedArticles([...catalog, current], current);
    expect(related.map((entry) => entry.articleId)).toEqual([
      "dd-macro",
      "dd-crypto",
      "intel-1",
    ]);
  });

  it("caps the list at the limit without duplicates", () => {
    const related = getRelatedArticles(catalog, signalMid, 1);
    expect(related).toHaveLength(1);
  });
});
