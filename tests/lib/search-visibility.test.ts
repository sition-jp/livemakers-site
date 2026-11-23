import { describe, expect, it } from "vitest";

import { isSearchIndexableArticle } from "@/lib/articles/search-visibility";

// 2026-11-23 (田平氏 GO・案 1): Signal は書き手の印のある記事だけを検索に出す。
// 発行側 (SDE) が印の無い Signal に search_index: false を付ける。項目が無い記事は
// 今までどおり検索に出す (過去の記事・ほかの種類・発行側が付け損ねた記事)
describe("lib/articles/search-visibility — isSearchIndexableArticle", () => {
  it("indexes an article that carries no search flag (fail-open)", () => {
    expect(isSearchIndexableArticle({ family: "signal" })).toBe(true);
    expect(isSearchIndexableArticle({ family: "deep-dive", searchIndex: undefined })).toBe(true);
  });

  it("leaves out an article the publisher marked searchIndex: false", () => {
    expect(isSearchIndexableArticle({ family: "signal", searchIndex: false })).toBe(false);
  });

  it("keeps an article marked searchIndex: true", () => {
    expect(isSearchIndexableArticle({ family: "signal", searchIndex: true })).toBe(true);
  });

  it("still leaves out flash, whatever the flag says", () => {
    expect(isSearchIndexableArticle({ family: "flash" })).toBe(false);
    expect(isSearchIndexableArticle({ family: "flash", searchIndex: true })).toBe(false);
  });
});
