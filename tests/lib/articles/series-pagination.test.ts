import { describe, expect, it } from "vitest";

import {
  SERIES_PAGE_SIZE,
  groupByJstDate,
  pageWindow,
  paginateSeries,
  parseSeriesPageParam,
  seriesPageHref,
} from "@/lib/articles/series-pagination";

const article = (id: string, publishedAtJst: string) => ({
  articleId: id,
  publishedAtJst,
});

const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    article(`a-${index}`, "2026-10-02T09:00:00+09:00"),
  );

describe("paginateSeries", () => {
  it("uses 30 articles per page", () => {
    expect(SERIES_PAGE_SIZE).toBe(30);
  });

  it("slices pages and reports the page count", () => {
    const articles = many(65);
    const first = paginateSeries(articles, 1);
    expect(first?.items).toHaveLength(30);
    expect(first?.items[0].articleId).toBe("a-0");
    expect(first?.totalPages).toBe(3);

    const last = paginateSeries(articles, 3);
    expect(last?.items.map((item) => item.articleId)).toEqual([
      "a-60",
      "a-61",
      "a-62",
      "a-63",
      "a-64",
    ]);
  });

  it("returns null for pages past the end", () => {
    expect(paginateSeries(many(30), 2)).toBeNull();
  });

  it("keeps an empty series on a single empty page 1", () => {
    expect(paginateSeries([], 1)).toEqual({
      items: [],
      page: 1,
      totalPages: 1,
    });
    expect(paginateSeries([], 2)).toBeNull();
  });
});

describe("parseSeriesPageParam", () => {
  it("accepts canonical positive integers only", () => {
    expect(parseSeriesPageParam("2")).toBe(2);
    expect(parseSeriesPageParam("12")).toBe(12);
    for (const bad of ["0", "-1", "02", "1.5", "abc", "", "2a"]) {
      expect(parseSeriesPageParam(bad), bad).toBeNull();
    }
  });
});

describe("seriesPageHref", () => {
  it("keeps page 1 on the series root URL", () => {
    expect(seriesPageHref("signal", 1)).toBe("/articles/series/signal");
    expect(seriesPageHref("signal", 4)).toBe("/articles/series/signal/page/4");
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps first, last and neighbours with gaps elsewhere", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageWindow(12, 12)).toEqual([1, null, 11, 12]);
    expect(pageWindow(3, 12)).toEqual([1, 2, 3, 4, null, 12]);
  });
});

describe("groupByJstDate", () => {
  it("groups consecutive articles by their JST calendar date", () => {
    const groups = groupByJstDate([
      article("a", "2026-10-02T20:15:00+09:00"),
      article("b", "2026-10-02T09:28:00+09:00"),
      article("c", "2026-10-01T17:30:00+09:00"),
    ]);
    expect(groups.map((group) => group.date)).toEqual([
      "2026-10-02",
      "2026-10-01",
    ]);
    expect(groups[0].items.map((item) => item.articleId)).toEqual(["a", "b"]);
  });

  it("returns no groups for an empty page", () => {
    expect(groupByJstDate([])).toEqual([]);
  });
});
