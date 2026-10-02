import { describe, expect, it } from "vitest";
import { parseSearchParams, searchHref } from "@/lib/search/parse-query";

describe("parseSearchParams", () => {
  it("splits on half/full-width spaces, dedupes, keeps the raw q for display", () => {
    expect(parseSearchParams({ q: " Midnight　ETF midnight " })).toEqual({
      q: "Midnight　ETF midnight",
      terms: ["midnight", "etf"],
      family: null,
      page: 1,
    });
  });
  it("caps q at 100 chars and terms at 5", () => {
    const parsed = parseSearchParams({ q: "a b c d e f g", page: "2" });
    expect(parsed.terms).toEqual(["a", "b", "c", "d", "e"]);
    expect(parseSearchParams({ q: "x".repeat(150) }).q).toHaveLength(100);
  });
  it("takes the first value of repeated params", () => {
    expect(parseSearchParams({ q: ["ada", "btc"] }).terms).toEqual(["ada"]);
  });
  it("accepts known families only and canonical page numbers only", () => {
    expect(
      parseSearchParams({ q: "x", family: "signal", page: "3" }),
    ).toMatchObject({ family: "signal", page: 3 });
    expect(
      parseSearchParams({ q: "x", family: "nope", page: "03" }),
    ).toMatchObject({ family: null, page: 1 });
  });
  it("empty / missing q yields no terms", () => {
    expect(parseSearchParams({}).terms).toEqual([]);
    expect(parseSearchParams({ q: "　 " }).terms).toEqual([]);
  });
});

describe("searchHref", () => {
  it("omits defaults", () => {
    expect(searchHref({ q: "Midnight ETF" })).toBe("/search?q=Midnight+ETF");
    expect(searchHref({ q: "x", family: "signal", page: 2 })).toBe(
      "/search?q=x&family=signal&page=2",
    );
    expect(searchHref({ q: "x", family: null, page: 1 })).toBe("/search?q=x");
  });
});
