import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import {
  LATEST_ARTICLES_COUNT,
  selectLatestArticles,
} from "@/lib/articles/latest-articles";

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

describe("selectLatestArticles", () => {
  it("is 20 rows, newest first, like the home right column", () => {
    const catalog = Array.from({ length: 25 }, (_, index) =>
      article(
        `sig-${index}`,
        "signal",
        `2026-09-${String(index + 1).padStart(2, "0")}T08:00:00+09:00`,
      ),
    );
    const latest = selectLatestArticles(catalog, "2026-10-02");
    expect(LATEST_ARTICLES_COUNT).toBe(20);
    expect(latest).toHaveLength(20);
    expect(latest[0].articleId).toBe("sig-24");
    expect(latest[19].articleId).toBe("sig-5");
  });

  it("excludes flash and articles dated after the JST article clock", () => {
    const latest = selectLatestArticles(
      [
        article("flash-1", "flash", "2026-10-02T09:00:00+09:00"),
        article("future-1", "signal", "2026-10-03T00:10:00+09:00"),
        article("today-1", "deep-dive", "2026-10-02T13:55:00+09:00"),
        article("prev-1", "daily-intel", "2026-10-01T05:50:00+09:00"),
      ],
      "2026-10-02",
    );
    expect(latest.map((row) => row.articleId)).toEqual(["today-1", "prev-1"]);
  });
});
